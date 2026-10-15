import { render } from "solid-js/web";
import { createSignal, For } from "solid-js";

// Deliberately broken: flights are kept in a plain signal and handed to
// <For> as freshly-decoded objects. Solid's <For> keys rows by object
// reference, not by Flight.id, so a full snapshot where every flight is a
// new object tears down and rebuilds every row on every tick.
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
          <For each={props.flights()}>
            {f => <tr><td>{f.flightNum}</td><td>{f.status}</td><td>{f.lastPing}</td></tr>}
          </For>
        </tbody>
      </table>
    </>
  );
}

window.__VDOM_DEMO_MOUNT__ = function (container, initialState) {
  const [region, setRegion] = createSignal(initialState.region);
  const [flights, setFlights] = createSignal(initialState.flights);
  render(() => <App region={region} flights={flights} />, container);
  return {
    update(newState) {
      setRegion(newState.region);   // no-op if unchanged - Solid signals compare by === by default
      setFlights(newState.flights); // BUG: every flight is a new reference -> <For> rebuilds all rows
    }
  };
};
