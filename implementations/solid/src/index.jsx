import { render } from "solid-js/web";
import { createSignal, For } from "solid-js";
import { createStore, reconcile } from "solid-js/store";

function App(props) {
  return (
    <>
      <div class="vdom-tabs-label">Region</div>
      <div class="vdom-tabs">
        {["Europe", "Africa", "Asia"].map(r =>
          <div class={`vdom-tab ${r === props.region() ? "active" : ""}`}>{r}</div>)}
      </div>
      <table class="vdom-table">
        <thead><tr><th>Flight</th><th>Status</th><th>Last ping</th></tr></thead>
        <tbody>
          {/* props.flights is a store, not a signal accessor - no () here */}
          <For each={props.flights}>
            {f => <tr><td>{f.flightNum}</td><td>{f.status}</td><td>{f.lastPing}</td></tr>}
          </For>
        </tbody>
      </table>
    </>
  );
}

window.__VDOM_DEMO_MOUNT__ = function (container, initialState) {
  const [region, setRegion] = createSignal(initialState.region);
  // createStore, not createSignal, for the list: reconcile below needs a
  // store to merge into, so it can preserve object identity per-row.
  const [flights, setFlights] = createStore(initialState.flights);

  render(() => <App region={region} flights={flights} />, container);

  return {
    update(newState) {
      setRegion(newState.region); // no-op if unchanged - Solid signals compare by === by default

      // reconcile matches incoming items to existing store items by `id`
      // (our Flight.id field, matched by default with zero config), keeps
      // the same object reference - and skips re-rendering entirely - for
      // any flight whose fields are unchanged, and only replaces the
      // specific fields that differ for ones that did change. Without
      // this, setFlights(newState.flights) would hand <For> a brand new
      // object for every row on every tick, since the generator spreads
      // every flight fresh each step - and <For> keys rows by reference,
      // so it would tear down and rebuild every row regardless of whether
      // that row's data actually changed.
      setFlights(reconcile(newState.flights));
    }
  };
};
