# SpecUpdate2.md — expose flawed vs. fixed fine-grained updates

**Baseline:** apply this after `SpecUpdate.md`. This is a planning update only;
do not implement it until the next step. Its purpose is to turn two findings
from the first benchmark into explicit, side-by-side demonstrations:

- The existing `laminar-fixed` only fixes unnecessary tab-bar updates. Its
  unkeyed table children still recreate flight rows on every incoming state.
- The Solid `createStore` + `reconcile` implementation is correct, but the
  demo should also preserve the earlier `createSignal` failure mode so the
  audience can see why identity-aware reconciliation matters.

The project grows from eight to ten implementations. The shared data model,
generator, harness protocol, styling, and sequence remain unchanged.

---

## 1. Rename the current Laminar "fixed" variant to `laminar-flawed`

Rename `implementations/laminar-fixed/` to
`implementations/laminar-flawed/`, including its top-level menu link and
all descriptive references in `SPEC.md`.

Rename its audience-facing description from "unbundled via `.distinct`
(fix)" to something explicit, such as:

> region isolated, but unkeyed rows rebuilt

Keep its current source behavior unchanged:

- `regionSignal = stateVar.signal.map(_.region).distinct` creates the tab
  elements once and avoids changing them on same-region ticks.
- `tbody(children <-- flightsSignal.map(_.map(renderFlightRow)))` remains
  deliberately unkeyed, so a new `List[Flight]` causes the table rows to be
  removed and recreated on every tick.

This variant is not the full fix. It is the intermediate, flawed attempt:
it correctly avoids tab churn, but still does almost full-table work for a
single changed ping.

**Acceptance checks:**

- The `Region` label and tab elements do not flash on same-region ticks.
- Same-region mutation counts remain near a full table rebuild because the
  rows are recreated.
- The page continues to satisfy the existing mount contract.

---

## 2. Add a truly fixed Laminar implementation

Create `implementations/laminar-fixed/` as a third Laminar page, sharing
its Scala CLI directives, mount contract, and static tab markup with
`laminar-flawed`.

The essential difference is the table body. Replace the unkeyed
`children <-- flightsSignal.map(_.map(renderFlightRow))` binding with
Laminar's keyed `split(_.id)` operator. `split` must retain one row view per
stable `Flight.id` and give that row a signal for subsequent updates. Each
cell should bind to the relevant field of that per-row signal, for example:

```scala
def renderFlightRow(flightSignal: Signal[Flight]) =
  tr(
    td(child.text <-- flightSignal.map(_.flightNum)),
    td(child.text <-- flightSignal.map(_.status)),
    td(child.text <-- flightSignal.map(_.lastPing))
  )

// In the tbody:
children <-- flightsSignal.split(_.id) { (_, _, flightSignal) =>
  renderFlightRow(flightSignal)
}
```

Use the exact `split` callback types/signature supplied by Laminar 17.2.1;
the intent is non-negotiable even if the local API requires small syntactic
adjustment. The row key is `Flight.id`, never object identity or list
position.

The fixed variant must retain the `.distinct` region signal from
`laminar-flawed`, so both static tabs and rows are updated incrementally.

**Acceptance checks:**

- Same-region `ping` ticks mutate only the affected last-ping cell (or a
  similarly small, field-scoped set), not all rows.
- `pingBatch` mutates approximately three last-ping cells.
- `statusFlip` changes one status cell.
- `add`/`remove` add or remove one row subtree; `reorder` moves retained row
  nodes instead of recreating the table.
- The Region label and tabs remain untouched on same-region ticks.
- On the common same-region workload, the fixed implementation's total is
  dramatically lower than both `laminar-naive` and `laminar-flawed`.

---

## 3. Add `solid-flawed`

Create `implementations/solid-flawed/`, using the same Vite/Solid tooling,
shared stylesheet, harness setup, and `Region` label as `solid`.

Its source intentionally uses a plain signal for the flights list and
passes freshly decoded flight objects directly to `<For>`:

```jsx
import { render } from "solid-js/web";
import { createSignal, For } from "solid-js";

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
      setRegion(newState.region);
      setFlights(newState.flights);
    }
  };
};
```

Do not add `createStore`, `reconcile`, custom keys, or memoization to this
variant. `<For>` associates entries by item reference; the generator creates
fresh flight objects every step, so it will treat every row as new and
rebuild the list despite stable `id` values.

The existing `implementations/solid/` remains the correct counterpart: it
uses `createStore` + `reconcile(newState.flights)`, whose default `id` key
preserves unchanged row identity and updates only changed fields.

**Acceptance checks:**

- `solid-flawed` leaves the `Region` label and tabs untouched on same-region
  ticks, confirming that the failure is limited to row identity.
- A same-region `ping` or `pingBatch` causes near-full-table row churn in
  `solid-flawed`.
- The same scripted tick updates only one or three cells in `solid`.
- `add`, `remove`, and `reorder` show the same contrast: row reconstruction
  in `solid-flawed` versus keyed reconciliation in `solid`.

---

## 4. Documentation and menu updates

Update `SPEC.md`, `index.html`, and the repository layout to describe ten
implementations:

| Pair | Flawed behavior | Correct behavior |
|---|---|---|
| Laminar | `laminar-naive`: bundled region + unkeyed rows; `laminar-flawed`: isolated region but unkeyed rows | `laminar-fixed`: `.distinct` region signal plus `split(_.id)` rows |
| Solid | `solid-flawed`: `<For>` receives fresh objects through `createSignal` | `solid`: `createStore` + `reconcile` by stable `id` |

Keep `react-naive` / `react-compiled` as their existing separate comparison.
All ten demos must remain reachable from the top-level menu and produce a
production `dist/index.html` plus a script bundle compatible with the shared
harness.

## 5. Expected narrative

The two new comparisons make a single principle concrete across different
reactive models: receiving a full snapshot is not itself a problem; losing
stable identity at the rendering boundary is. Fine-grained reactivity only
produces fine-grained DOM changes when both state propagation and child
identity are modeled correctly.
