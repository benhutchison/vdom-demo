
# VDOM or Not VDOM — Demo Project Spec (v3)

*Versions pinned below are current as of August 1, 2026. If implementation
starts more than a few weeks after that, spot-check the ones marked below
before scaffolding - everything else in this stack is stable enough not to
matter.*

**Changes since v2** (kept here so nobody has to reconstruct why something
looks the way it does):

- `harness/harness.js` and `implementations/solid/src/main.jsx` are now
  provided as **external file artifacts**, not embedded as code blocks in
  this document — see Section 6.2 and Task 5. Copy them in verbatim; don't
  reconstruct them from prose.
- The harness now tracks same-region and region-switch metrics separately,
  with running totals, per-tick averages, a "last update" readout, and an
  audience-facing glossary (hover tooltips + on-page anchor links) for every
  metric — see Section 6.2.
- Fixed a real bug in the `MutationObserver` wiring: `childList` mutations
  were being attributed to the parent container instead of the actual
  added/removed nodes, which silently undercounted and flashed the wrong
  element. Now walks `addedNodes`/`removedNodes` and their descendants,
  matching how the "naive full-tree size" metric counts nodes elsewhere.
- Fixed region-switch tick counting to compare region values directly
  rather than trusting the generator's `kind` label — robust even if
  `sequence.json` hasn't been regenerated after a `generate.mjs` change.
- `generate.mjs` now tags every sequence step with a `kind` field
  (`ping` / `statusFlip` / `add` / `remove` / `reorder` / `regionSwitch` /
  `initial`) so the harness can label what just happened, not just count it.
- Found and fixed a real bug in the original Solid implementation — see
  Task 5's "known issue" callout. Worth reading even if you're not
  implementing Solid yourself, since the same failure mode is possible
  anywhere reconciliation depends on object identity.

## 0. How to use this document

You are implementing a small multi-framework demo for a conference talk.
The demo lets a presenter click "Apply" repeatedly on a scripted sequence of
state updates and watch, side by side across eight implementations, how many
real DOM nodes each one actually touches per update.

**Read Section 1 (Prerequisites) first and stop if anything there is
missing** — that section lists exactly what must already be installed
before you start, so you don't lose time mid-task chasing a missing CLI
tool. Everything needed is listed there; don't install additional global
tools or ask about alternatives not listed without flagging it first.

After that, work through **Section 7 in the order given** — Task 0 must
come first; Tasks 1, 2, 4, 5, 6, 7 can then proceed in any order or in
parallel; Task 3 depends on Task 2 (copies its source); Task 8 is
conceptually "the fix for Task 7" but its code is independent, so it can be
written in parallel with Task 7 too. Each task has a goal, exact
dependency versions, required code (or a pointer to an external artifact),
and an **acceptance check** you must pass before considering that task done.

---

## 1. Prerequisites — confirm all of this before starting

This is a checklist for the person running this project to confirm or
install *before* implementation starts. If any of these is missing, stop
and flag it rather than trying to work around it or substitute something
else.

| Tool | Version needed | Why | Check with |
|---|---|---|---|
| Node.js | 24.x (current Active LTS) | Vite 8 requires Node 20.19+ or 22.12+; Node 24 covers this with headroom | `node --version` |
| npm | bundled with Node 24 | package installs for Tasks 1-3, 5-6 | `npm --version` |
| scala-cli | any recent release | Tasks 7-8 (Laminar) | `scala-cli version` |
| A JVM | Java 17+ | scala-cli needs a JVM under the hood | `java -version` |
| Elm | 0.19.2 (released July 2026), or 0.19.1 if 0.19.2 isn't available through your install method yet | Task 4 | `elm --version` |
| A static file server | anything - `npx serve` needs nothing pre-installed beyond Node/npm | Section 8 | - |

**Elm version note:** Elm shipped its first release in six years on July 6,
2026 (0.19.2), a performance-only patch with no API or language changes
from 0.19.1. The `elm` npm installer package may not have been updated to
fetch it yet. If `npm install elm@latest-0.19.1` is all that's available,
that's completely fine for this project since nothing in Task 4 depends on
anything new in 0.19.2.

**Do not install:** Docker, webpack, sbt, or any JS bundler beyond what's
listed per-task below. If a task seems to need one of these, that's a sign
something in this spec should be revisited - flag it rather than reaching
for extra tooling.

**Pinned versions used throughout this spec** (current as of August 1,
2026; check again only if picking this project back up well after that):

| Package | Version |
|---|---|
| react / react-dom | 19.2.8 |
| vite | 8.2.0 |
| @vitejs/plugin-react | ^6 |
| babel-plugin-react-compiler | 1.0.0 |
| @rolldown/plugin-babel | latest compatible with Vite 8 |
| solid-js | 1.9.14 (stay on the 1.x line - 2.0 is still beta) |
| svelte | 5.56.8 |
| @sveltejs/vite-plugin-svelte | 7.2.0 |
| elm | 0.19.2 (0.19.1 acceptable, see note above) |
| Scala | 3.8.3 |
| com.raquo::laminar | 17.2.1 (requires Scala.js 1.16.0+, scala-cli resolves this automatically) |

---

## 2. What we're building & why

Eight small apps render the same UI (a region tab bar + a table of flights)
from the same data, driven by the same scripted sequence of state updates.
A shared "harness" (plain HTML/CSS/JS, no framework, no build step) is
responsible for:

- showing the current/next state and an "Apply" button (the boring, honest
  data view)
- feeding each implementation the same deterministic sequence of updates
- counting, via `MutationObserver`, how many real DOM nodes each update
  actually touched, broken down by same-region vs. region-switch ticks
- briefly flashing any DOM node that got mutated
- explaining each displayed metric in plain language, for an audience that
  may not be deeply DOM-internals-literate

Only the "real UI" (tab bar + table) differs per implementation. The eight
implementations are:

| # | Directory | What it shows |
|---|---|---|
| 1 | `vanilla` | naive full `innerHTML` rebuild every tick - the true worst-case baseline |
| 2 | `react-naive` | React, no memoization anywhere, re-renders from the root every tick |
| 3 | `react-compiled` | byte-identical source to #2, but built with the React Compiler enabled |
| 4 | `elm` | virtual-dom diffing + `Html.Lazy`, driven externally via a port |
| 5 | `solid` | fine-grained signals/store, region and flights kept separately, flights merged via `reconcile` |
| 6 | `svelte` | Svelte 5 runes, single `$state` proxy object, accessed per-field |
| 7 | `laminar-naive` | Airstream FRP, region+flights bundled into one signal (deliberately wrong) |
| 8 | `laminar-fixed` | same as #7, but region is unbundled via `.distinct` |

The naive/fixed Laminar pair and the naive/compiled React pair are the two
most important *deliberately staged* comparisons in the whole demo. Task 5's
Solid implementation turned up a third, *organically discovered* instance
of the same underlying lesson — see that task's "known issue" callout —
which may be worth including in the talk alongside the staged pairs, since
it wasn't engineered in on purpose.

---

## 3. Repository layout

```
vdom-demo/
├── index.html                      # top-level menu linking to all 8 demos
├── VERSIONS.md                     # record exact installed tool versions here - see Def. of Done
├── harness/
│   ├── harness.js                  # EXTERNAL ARTIFACT - copy in verbatim, see Section 6.2
│   ├── harness.css                 # shared styling - every impl reuses these class names verbatim
│   └── sequence/
│       ├── generate.mjs            # deterministic sequence generator (Node, no deps) - Section 6.1
│       └── sequence.json           # committed output of `node generate.mjs`
└── implementations/
    ├── vanilla/
    ├── react-naive/
    ├── react-compiled/
    ├── elm/
    ├── solid/
    │   └── src/main.jsx            # EXTERNAL ARTIFACT - copy in verbatim, see Task 5
    ├── svelte/
    ├── laminar-naive/
    └── laminar-fixed/
```

Each `implementations/<name>/` directory owns its own toolchain (its own
`package.json` / `elm.json` / scala-cli project) and produces a production
build at `implementations/<name>/dist/`, containing at minimum:

- `index.html` - loads `../../../harness/harness.css`, `../../../harness/harness.js`,
  and this implementation's own compiled JS, then calls `VdomHarness.init(...)`
- one compiled JS bundle exposing a single global function (see Section 5)

The whole repo is served for the live talk by one static file server at
the repo root (e.g. `npx serve .`), never by 8 separate dev servers - that
way relative paths to the shared harness resolve identically everywhere and
switching frameworks during the talk is just clicking a different link on
the top-level `index.html`.

---

## 4. Canonical data model

```ts
type Region = "Europe" | "Africa" | "Asia";

type Flight = {
  id: string;         // stable identity key - never changes for a given flight
  flightNum: string;  // immutable, display-only
  status: "Airborne" | "Landed"; // slow-changing
  lastPing: number;   // fast-changing counter
};

type State = {
  region: Region;
  flights: Flight[];
};
```

Every implementation receives a full `State` object on every update (never a
diff) - it is each implementation's own job to decide how much of that it
actually needs to touch. This mirrors how data really arrives over the wire
and is the whole point of the region/flights split.

**A cross-cutting note that Task 5's bug makes concrete for the whole
project:** "receives a full object every time" does not mean every
implementation is free to ignore identity. `id` is stable by design
specifically so that frameworks/patterns relying on object or key identity
(Solid's `<For>`, keyed reconciliation generally) have something reliable
to match against — the generator preserves `id` per logical flight across
steps, but does *not* guarantee object-reference stability for unchanged
flights across steps (see Section 6.1) — each implementation, not the data
layer, is responsible for reconciling by `id` where its own framework's
performance depends on it.

---

## 5. The mount contract

This is the single most important section - every implementation must
conform to it exactly, since the shared harness only knows how to talk to
implementations through this contract, never through framework-specific
APIs.

Every implementation's compiled bundle must, when loaded, set:

```js
window.__VDOM_DEMO_MOUNT__ = function (container, initialState) {
  // ... mount your framework's app into `container` using `initialState` ...
  return {
    update(newState) {
      // ... apply newState to your already-mounted app ...
    }
  };
};
```

- `container` is a plain `HTMLElement`, already present in the DOM.
- `mount` is called exactly once per page load.
- `update` is called once per "Apply" click, always with a complete
  `State` object (see Section 4), never a partial one.
- `update` must not throw, and must not recreate `container` itself (the
  harness's `MutationObserver` is watching `container`'s subtree - replacing
  `container` itself would break the instrumentation, but replacing/rebuilding
  everything *inside* it, as `vanilla` deliberately does, is fine and in
  fact the point for that one implementation).

Because only one implementation's bundle is ever loaded on a given page (see
Section 3), every implementation can use the exact same global name -
there's no need for per-framework namespacing.

**Elm is the one framework without a native way to receive an external
"here's new state" call.** Use a port (see Task 4) - don't try to invent
something else.

---

## 6. Shared harness (build this first - Task 0)

### 6.1 Sequence generator

`harness/sequence/generate.mjs` - deterministic, seeded, no npm dependencies.
Cycles through a fixed recipe of transition kinds so every kind of change
(ping-only, single-field flip, add, remove, reorder, region-switch) is
guaranteed to occur rather than hoped-for from randomness. Every step is
tagged with a `kind` field so the harness can label what just happened, not
just count it.

**Note on object identity:** each step's `flights` array is a fresh JS
array, and any flight actually mutated in that step gets a fresh object -
this is correct and necessary so each committed step is an independent,
immutable snapshot. Unrelated, unchanged flights are *not* specially
preserved as the same reference here, and — separately, and more
fundamentally — even if they were, `JSON.stringify`/`JSON.parse` across the
`sequence.json` round-trip would discard that reference sharing anyway,
since JSON has no concept of shared references. Do not try to fix Task 5's
identity problem here; it has to be solved on the consuming side (see Task
5), because the data layer fundamentally cannot preserve JS object identity
across a JSON file.

```js
// harness/sequence/generate.mjs
// Run: node generate.mjs [--rows=40] [--steps=60] [--switchEvery=9] [--seed=20260731] > sequence.json

const REGIONS = ["Europe", "Africa", "Asia"];

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map(a => a.replace(/^--/, "").split("="))
  );
  return {
    rows: Number(args.rows ?? 40),
    steps: Number(args.steps ?? 60),
    switchEvery: Number(args.switchEvery ?? 9),
    seed: Number(args.seed ?? 20260731),
  };
}

function makeFlight(rng, id) {
  return {
    id,
    flightNum: `FL${100 + Math.floor(rng() * 900)}`,
    status: rng() < 0.5 ? "Airborne" : "Landed",
    lastPing: 0,
  };
}

function initialFlights(rng, rows) {
  return Array.from({ length: rows }, (_, i) => makeFlight(rng, `f${i}`));
}

// Fixed recipe: guarantees coverage of every transition kind rather than
// relying on chance. Tweak the mix here if you want more/fewer of a kind.
const RECIPE = ["ping", "ping", "statusFlip", "add", "ping", "remove", "reorder", "ping"];

function applyStep(rng, prevFlights, kind, nextId) {
  let flights = prevFlights.map(f => ({ ...f }));
  switch (kind) {
    case "ping": {
      const i = Math.floor(rng() * flights.length);
      flights[i] = { ...flights[i], lastPing: flights[i].lastPing + 1 };
      break;
    }
    case "statusFlip": {
      const i = Math.floor(rng() * flights.length);
      flights[i] = { ...flights[i], status: flights[i].status === "Airborne" ? "Landed" : "Airborne" };
      break;
    }
    case "add": {
      flights.push(makeFlight(rng, `f${nextId.n++}`));
      break;
    }
    case "remove": {
      if (flights.length > 3) flights.splice(Math.floor(rng() * flights.length), 1);
      break;
    }
    case "reorder": {
      const start = Math.floor(rng() * flights.length);
      const len = Math.min(flights.length - start, 4);
      const slice = flights.slice(start, start + len);
      for (let i = slice.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [slice[i], slice[j]] = [slice[j], slice[i]];
      }
      flights.splice(start, len, ...slice);
      break;
    }
  }
  return flights;
}

function generate({ rows, steps, switchEvery, seed }) {
  const rng = mulberry32(seed);
  let region = REGIONS[0];
  let flights = initialFlights(rng, rows);
  const nextId = { n: rows };
  const sequence = [{ region, flights, kind: "initial" }];

  for (let s = 0; s < steps; s++) {
    let kind;
    if ((s + 1) % switchEvery === 0) {
      const others = REGIONS.filter(r => r !== region);
      region = others[Math.floor(rng() * others.length)];
      flights = initialFlights(rng, rows); // a region switch means a whole new flight list
      kind = "regionSwitch";
    } else {
      kind = RECIPE[s % RECIPE.length];
      flights = applyStep(rng, flights, kind, nextId);
    }
    sequence.push({ region, flights: flights.map(f => ({ ...f })), kind });
  }
  return sequence;
}

const config = parseArgs();
process.stdout.write(JSON.stringify({ config, sequence: generate(config) }, null, 2));
```

**Acceptance check:** `node generate.mjs > sequence.json` runs with no
dependencies installed, produces valid JSON, `sequence.length === steps + 1`,
every entry has a `kind` field, and re-running with the same args
byte-for-byte reproduces the same file.

### 6.2 `harness/harness.js` — external artifact

**This file is provided separately and must be copied in verbatim to
`harness/harness.js`.** It is no longer reproduced as a code block here —
treat the provided file as the single source of truth rather than
reconstructing it from this description. What it does:

- fetches `sequence.json` once (including the generator's `config`, e.g.
  `config.rows`, not just the sequence array)
- calls `mount()` once, then `update()` on every Apply click
- tracks metrics **separately** for same-region ticks and region-switch
  ticks: tick counts, cumulative mutation totals, and per-tick averages —
  plus a "last update" readout showing what kind of change just happened
  and how many nodes it touched, so a single bad tick isn't hidden inside a
  running average
- **buckets same-region vs. region-switch by directly comparing the
  previous and next `region` values** — not by trusting the generator's
  `kind` label — so the counters stay correct even if `sequence.json`
  hasn't been regenerated after a `generate.mjs` change
- every metric has a hover tooltip (native `title` attribute) and a real
  anchor link into an on-page glossary (`<details>` disclosure, no JS
  toggling) with a plain-language definition — written for someone watching
  the talk, not for a developer reading the source
- the `MutationObserver` correctly walks `childList` mutations'
  `addedNodes`/`removedNodes` (and each one's own descendant elements, via
  `querySelectorAll('*')`) rather than attributing the whole change to the
  parent container — this matters because `m.target` for a `childList`
  mutation is the *parent*, not the changed node; get this wrong and you
  silently undercount added/removed subtrees and flash the wrong element
  (see the "Changes since v2" note at the top of this document)
- flashes only the top-level added node for a `childList` change (its
  background covers its own children visually - no need to flash every
  descendant individually) and disconnects/reconnects the observer once per
  batch around its own `classList` writes, so the flash doesn't trigger an
  infinite loop of self-observed attribute mutations
- exposes `settleDelayMs` (default 50ms, stacked on top of a double
  `requestAnimationFrame`) as a per-implementation override in
  `VdomHarness.init({ ..., settleDelayMs: N })`, for any framework whose
  commit timing needs longer than the default before the mutation count is
  read — see the timing discussion earlier in this project's history if you
  need to re-derive why this exists; React's automatic batching and
  concurrent scheduler are the primary reason any implementation might need
  a longer value than the default.
- the Apply button is positioned *before* the Current/Next labels in the
  markup, so its position on screen doesn't shift as those labels' text
  length varies between ticks

### 6.3 `harness/harness.css`

```css
body { font-family: system-ui, sans-serif; margin: 0; padding: 16px; }
#vdom-demo-upper { border: 1px solid #ccc; border-radius: 8px; padding: 12px; margin-bottom: 16px; background: #fafafa; }
.vdom-demo-upperrow { display: flex; gap: 24px; align-items: center; margin-bottom: 8px; }
#vdom-demo-apply { padding: 6px 16px; font-size: 1em; cursor: pointer; }

.vdom-tabs { display: flex; gap: 8px; margin-bottom: 8px; }
.vdom-tab { padding: 6px 14px; border: 1px solid #ccc; border-radius: 6px 6px 0 0; }
.vdom-tab.active { background: #333; color: white; font-weight: bold; }

.vdom-table { width: 100%; border-collapse: collapse; }
.vdom-table th, .vdom-table td { border-bottom: 1px solid #eee; padding: 4px 10px; text-align: left; }

.vdom-demo-flash { background-color: #fff176 !important; transition: background-color 0.4s ease-out; }

/* metrics grid */
.vdom-demo-metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 8px; }
.vdom-metric { border: 1px solid #ddd; border-radius: 6px; padding: 8px 10px; background: white; }
.vdom-metric-label { font-size: 0.85em; color: #555; display: block; }
.vdom-metric-value { font-size: 1.3em; font-weight: bold; display: block; }
.vdom-metric-sub { font-size: 0.78em; color: #888; display: block; }
.vdom-info { text-decoration: none; color: #6b8; margin-left: 4px; cursor: help; }
.vdom-next-kind { font-size: 0.85em; color: #777; }

/* glossary */
.vdom-glossary { margin-top: 8px; font-size: 0.9em; }
.vdom-glossary summary { cursor: pointer; color: #333; }
.vdom-glossary dt { font-weight: bold; margin-top: 6px; }
.vdom-glossary dd { margin: 2px 0 0 0; color: #555; }
.vdom-glossary [id]:target dt { background: #fff176; }
```

**Rule for every implementation task below: reuse these exact class names
(`vdom-tabs`, `vdom-tab`, `active`, `vdom-table`) verbatim. Do not bring in a
CSS framework or write competing styles.** The point is that the rendered
output looks identical no matter which implementation is mounted - the only
visible difference should be the counters and the flash.

### 6.4 Top-level `index.html`

A one-page menu linking to `implementations/<name>/dist/index.html` for all
8 implementations, grouped as: Vanilla baseline / React (naive vs compiled)
/ Elm / Solid / Svelte / Laminar (naive vs fixed). Plain links, no JS needed.

**Acceptance check for Task 0:** `sequence.json` exists, is valid, and every
entry has a `kind` field; `harness.js` (the external artifact) and
`harness.css` exist at the paths above - nothing else can be tested yet
since there's no implementation to mount - proceed to Task 1.

---

## 7. Implementation tasks

**Tasks 1, 2, 4, 5, 6, 7 have no dependencies on each other and can be done
in any order, including in parallel.** Task 3 requires Task 2's source
directory to exist first (it's copied verbatim). Task 8 is easiest to write
right after Task 7 since it's a small diff on the same file, but nothing
technically blocks writing it in parallel.

Each implementation's `index.html` follows this template (only the script
`src` and the mount-container id differ):

```html
<!doctype html>
<html><head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="../../../harness/harness.css">
</head><body>
  <div id="vdom-demo-upper"></div>
  <div id="app-root"></div>
  <script src="./bundle.js"></script>
  <script src="../../../harness/harness.js"></script>
  <script>
    VdomHarness.init({ mount: window.__VDOM_DEMO_MOUNT__ });
  </script>
</body></html>
```

### Task 1 - `vanilla` (naive full rebuild baseline)

No build tooling needed at all - plain JS.

```js
// implementations/vanilla/main.js
function render(state) {
  const tabs = ["Europe", "Africa", "Asia"].map(r =>
    `<div class="vdom-tab ${r === state.region ? "active" : ""}">${r}</div>`).join("");
  const rows = state.flights.map(f =>
    `<tr><td>${f.flightNum}</td><td>${f.status}</td><td>${f.lastPing}</td></tr>`).join("");
  return `<div class="vdom-tabs">${tabs}</div>
    <table class="vdom-table"><thead><tr><th>Flight</th><th>Status</th><th>Last ping</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
}

window.__VDOM_DEMO_MOUNT__ = function (container, initialState) {
  container.innerHTML = render(initialState);
  return {
    update(newState) {
      container.innerHTML = render(newState); // deliberately naive - full rebuild, every tick
    }
  };
};
```

**Acceptance check:** open `implementations/vanilla/index.html` via the
repo-root static server, click Apply repeatedly, confirm the tab bar and
table visibly update and the "same-region" mutation count is large -
roughly proportional to total node count, since everything gets rebuilt
every time. This number is your baseline for every other implementation.

### Task 2 - `react-naive`

Scaffold with `npm create vite@latest react-naive -- --template react`,
then set the dependency versions explicitly:

```json
{
  "dependencies": { "react": "19.2.8", "react-dom": "19.2.8" },
  "devDependencies": { "vite": "8.2.0", "@vitejs/plugin-react": "^6" }
}
```

No memoization anywhere in this component tree - that's the point.

```jsx
// implementations/react-naive/src/main.jsx (also used verbatim by react-compiled - see Task 3)
import { createRoot } from "react-dom/client";

function TabBar({ region }) {
  return (
    <div className="vdom-tabs">
      {["Europe", "Africa", "Asia"].map(r =>
        <div key={r} className={`vdom-tab ${r === region ? "active" : ""}`}>{r}</div>)}
    </div>
  );
}

function FlightTable({ flights }) {
  return (
    <table className="vdom-table">
      <thead><tr><th>Flight</th><th>Status</th><th>Last ping</th></tr></thead>
      <tbody>
        {flights.map(f => (
          <tr key={f.id}><td>{f.flightNum}</td><td>{f.status}</td><td>{f.lastPing}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

function App({ state }) {
  return (<><TabBar region={state.region} /><FlightTable flights={state.flights} /></>);
}

window.__VDOM_DEMO_MOUNT__ = function (container, initialState) {
  const root = createRoot(container);
  root.render(<App state={initialState} />);
  return {
    update(newState) { root.render(<App state={newState} />); } // re-render from the root every tick
  };
};
```

Build for production (`npm run build`), copy the output into
`implementations/react-naive/dist/`, and use the standard `index.html`
template from Section 7, pointing `bundle.js` at Vite's built output filename.

**Acceptance check:** works like Task 1, but region-switch ticks and
same-region ticks should show smaller numbers than `vanilla`'s baseline for
equivalent state changes (React's diffing is doing real work here even
without memoization) - but the two counters should be roughly similar to
each other, since nothing is skipping the tab bar's re-render function call
(the DOM result is still correct and minimal thanks to diffing - see the
note in Task 3 for what specifically should change).

### Task 3 - `react-compiled`

Copy `react-naive`'s `src/` directory verbatim, byte-for-byte identical.
The only difference in this whole task is enabling the React Compiler in
the build config. Do not add any `useMemo`/`useCallback`/`React.memo` by
hand anywhere - the entire point of this task is that the compiler inserts
equivalent memoization automatically from identical source.

As of Vite 8 / `@vitejs/plugin-react` v6, the old
`react({ babel: { plugins: [...] } })` pattern no longer works - v6
dropped Babel in favor of oxc for the JSX transform, so React Compiler
(which is a Babel plugin) has to be wired in separately:

```bash
npm install -D @rolldown/plugin-babel @babel/core babel-plugin-react-compiler
```

```js
// implementations/react-compiled/vite.config.js
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})
```

**Acceptance check:** using the exact same scripted sequence, this
implementation's same-region-tick counter should be measurably lower than
`react-naive`'s, since a flights-only update should no longer cause the tab
bar's DOM to be touched at all (compiler-inserted memoization should let
React skip re-invoking `TabBar` when `region` hasn't changed). If you don't
see a measurable difference, check the build output confirms the Babel
plugin actually ran (look for compiler-inserted `_c()` cache-slot calls in
the built bundle) before concluding it isn't working - this toolchain
combination is only months old as of this spec, so verify empirically
rather than assume the config above is exactly right for whatever patch
versions you land on.

### Task 4 - `elm`

Scaffold a standard Elm app (`elm.json` via `elm init`, compiled with
`elm make`). Elm has no native way to receive external state pushes - use
a port.

```elm
-- implementations/elm/src/Main.elm
port module Main exposing (main)

import Browser
import Html exposing (Html, div, table, thead, tbody, tr, th, td, text)
import Html.Attributes exposing (class)
import Html.Lazy exposing (lazy, lazy2)
import Json.Decode as D

type alias Flight = { id : String, flightNum : String, status : String, lastPing : Int }
type alias Model = { region : String, flights : List Flight }

port stateUpdates : (D.Value -> msg) -> Sub msg

flightDecoder : D.Decoder Flight
flightDecoder =
    D.map4 Flight
        (D.field "id" D.string)
        (D.field "flightNum" D.string)
        (D.field "status" D.string)
        (D.field "lastPing" D.int)

modelDecoder : D.Decoder Model
modelDecoder =
    D.map2 Model
        (D.field "region" D.string)
        (D.field "flights" (D.list flightDecoder))

type Msg = NewState D.Value

main : Program D.Value Model Msg
main =
    Browser.element
        { init = \flags -> ( D.decodeValue modelDecoder flags |> Result.withDefault { region = "Europe", flights = [] }, Cmd.none )
        , update = \(NewState v) _ -> ( D.decodeValue modelDecoder v |> Result.withDefault { region = "Europe", flights = [] }, Cmd.none )
        , view = view
        , subscriptions = \_ -> stateUpdates NewState
        }

viewTabBar : String -> Html Msg
viewTabBar region =
    div [ class "vdom-tabs" ]
        (List.map (\r -> div [ class ("vdom-tab" ++ (if r == region then " active" else "")) ] [ text r ])
            [ "Europe", "Africa", "Asia" ])

viewFlightTable : List Flight -> Html Msg
viewFlightTable flights =
    table [ class "vdom-table" ]
        [ thead [] [ tr [] [ th [] [ text "Flight" ], th [] [ text "Status" ], th [] [ text "Last ping" ] ] ]
        , tbody [] (List.map (\f -> tr [] [ td [] [ text f.flightNum ], td [] [ text f.status ], td [] [ text (String.fromInt f.lastPing) ] ]) flights)
        ]

view : Model -> Html Msg
view model =
    div []
        [ lazy viewTabBar model.region
        , lazy viewFlightTable model.flights
        ]
```

```js
// implementations/elm/main.js - the mount-contract adapter
window.__VDOM_DEMO_MOUNT__ = function (container, initialState) {
  const app = Elm.Main.init({ node: container, flags: initialState });
  return { update(newState) { app.ports.stateUpdates.send(newState); } };
};
```

**Acceptance check:** same-region ticks should show the tab bar untouched
(zero mutations attributable to it) thanks to `lazy`, since `model.region`
retains reference equality across a flights-only update - confirm this by
temporarily removing the `lazy` wrapper and checking the counter goes up,
then restoring it.

### Task 5 - `solid`

Scaffold via Vite's Solid template, pin `solid-js` to `1.9.14` (stay on the
1.x line - 2.0 is still beta as of this spec). `solid-js/store` is part of
the same package - no extra install needed.

**`implementations/solid/src/main.jsx` is provided as an external
artifact** — copy it in verbatim rather than writing this from scratch, for
the reason explained immediately below.

**Known issue we hit building this, and why the fix matters:** an earlier
version of this implementation used a plain `createSignal` for the flights
list:

```js
const [flights, setFlights] = createSignal(initialState.flights);
// ...
update(newState) { setFlights(newState.flights); }
```

This looked correct and passed a casual glance, but testing showed a
**same-region `ping` tick touching ~320 DOM nodes on a 40-row (171-node)
table** — more nodes than exist in the entire tree, which only happens when
whole subtrees are being destroyed and rebuilt rather than updated in
place. The cause: Solid's `<For>` keys each rendered row by the **object
reference** of the array item, not by any `id` field inside it. The
generator's `applyStep` (Section 6.1) spreads every flight into a fresh
object on every step, including the 39 that didn't change at all — so from
`<For>`'s point of view, all 40 incoming objects are "new," regardless of
whether their actual field values changed. `<For>` tore down and rebuilt
every row, every tick.

The fix is `createStore` + `reconcile` in place of `createSignal`:
`reconcile`'s default matching key is `"id"` — which lines up with our
`Flight.id` field with zero configuration — and it preserves object
identity (and skips re-rendering entirely) for any flight whose fields are
unchanged, patching only the specific fields that actually differ for ones
that did change. This is what the provided `main.jsx` artifact implements.
Note this is fixed on the *consuming* side, in Solid's own code — not by
changing the generator (see the identity note at the end of Section 6.1
for why that wouldn't have worked anyway).

**This is worth considering for the talk itself, alongside the staged
Laminar naive/fixed pair** — it's the same underlying lesson (a
fine-grained framework is not automatically safe; it only works if the data
feeding it has stable identity where the framework needs it), but this one
was found through genuine testing rather than deliberately engineered in.

**Acceptance check:** same-region `ping` ticks should show single-digit
mutation counts (ideally 1 — just the changed `<td>`'s text), not counts
anywhere near the naive full-tree size. `add`/`remove` should show roughly
one row's worth of nodes, not the whole table. `reorder` should show a
small number too — `reconcile` preserving identity for repositioned items
should let `<For>` move existing DOM nodes rather than recreate them; if
`reorder` shows a full-table-sized count, check nothing regressed back to
a plain signal.

### Task 6 - `svelte`

Scaffold via Vite's Svelte template, pin `svelte` to `5.56.8` and
`@sveltejs/vite-plugin-svelte` to `7.2.0`. Svelte 5 with runes (not
legacy `export let` reactivity).

```svelte
<!-- implementations/svelte/src/App.svelte -->
<script>
  let { state } = $props(); // do NOT destructure this into { region, flights } - that
                              // flattens the reactive proxy and breaks per-field tracking
</script>

<div class="vdom-tabs">
  {#each ["Europe", "Africa", "Asia"] as r}
    <div class="vdom-tab {r === state.region ? 'active' : ''}">{r}</div>
  {/each}
</div>
<table class="vdom-table">
  <thead><tr><th>Flight</th><th>Status</th><th>Last ping</th></tr></thead>
  <tbody>
    {#each state.flights as f (f.id)}
      <tr><td>{f.flightNum}</td><td>{f.status}</td><td>{f.lastPing}</td></tr>
    {/each}
  </tbody>
</table>
```

```js
// implementations/svelte/src/main.js
import { mount } from "svelte";
import App from "./App.svelte";

window.__VDOM_DEMO_MOUNT__ = function (container, initialState) {
  const state = $state(initialState); // a deeply-reactive proxy object
  mount(App, { target: container, props: { state } });
  return {
    update(newState) {
      state.region = newState.region;
      state.flights = newState.flights;
    }
  };
};
```

**Acceptance check:** same-region ticks show zero tab-bar mutations, because
the compiled template only reads `state.region` where it's used and Svelte's
per-property proxy tracking means writing `state.flights` alone doesn't
invalidate anything that only reads `state.region`. If you see tab-bar
mutations on flights-only ticks, check nothing anywhere destructured
`state`. **Given what Task 5 turned up, also specifically check the
`{#each state.flights as f (f.id)}` keying is actually working as expected**
on `ping` ticks — Svelte's `#each` is keyed explicitly by `(f.id)` here
(unlike Solid's `<For>`, which keys by reference unless you use a store),
so this particular implementation shouldn't be vulnerable to the same
failure mode, but confirm empirically rather than assume, same as
everywhere else in this spec.

### Task 7 - `laminar-naive` (deliberately wrong)

Scaffold via scala-cli. Use a `//> using` directive header pinning Scala
and Laminar:

```scala
//> using scala "3.8.3"
//> using platform "js"
//> using dep "com.raquo::laminar:17.2.1"
```

Region and flights are bundled into one signal, and the tab bar is rebuilt
via `child <--`, which replaces the whole element on every emission.

```scala
// implementations/laminar-naive/main.scala
//> using scala "3.8.3"
//> using platform "js"
//> using dep "com.raquo::laminar:17.2.1"

import com.raquo.laminar.api.L._
import org.scalajs.dom
import scala.scalajs.js
import scala.scalajs.js.annotation.JSExportTopLevel

case class Flight(id: String, flightNum: String, status: String, lastPing: Int)
case class DemoState(region: String, flights: List[Flight])

def decodeState(v: js.Any): DemoState = {
  val d = v.asInstanceOf[js.Dynamic]
  DemoState(
    region = d.region.asInstanceOf[String],
    flights = d.flights.asInstanceOf[js.Array[js.Dynamic]].toList.map(f =>
      Flight(f.id.asInstanceOf[String], f.flightNum.asInstanceOf[String],
             f.status.asInstanceOf[String], f.lastPing.asInstanceOf[Int]))
  )
}

def renderFlightRow(f: Flight) =
  tr(td(f.flightNum), td(f.status), td(f.lastPing.toString))

def renderTabBar(region: String): Div =
  div(cls := "vdom-tabs",
    List("Europe", "Africa", "Asia").map(r =>
      div(cls := s"vdom-tab${if (r == region) " active" else ""}", r)))

@JSExportTopLevel("__VDOM_DEMO_MOUNT__")
def mount(container: dom.Element, initialStateJs: js.Any): js.Object = {
  val stateVar = Var(decodeState(initialStateJs))

  val app: Div =
    div(
      // BUG, ON PURPOSE: rebuilds and replaces the whole tab bar on every emission,
      // including flights-only ticks where region never changed.
      child <-- stateVar.signal.map(s => renderTabBar(s.region)),
      table(cls := "vdom-table",
        thead(tr(th("Flight"), th("Status"), th("Last ping"))),
        tbody(children <-- stateVar.signal.map(s => s.flights.map(renderFlightRow)))
      )
    )

  render(container, app)
  js.Dynamic.literal(update = (newStateJs: js.Any) => stateVar.set(decodeState(newStateJs)): Unit)
}
```

Package it with:

```bash
scala-cli --power package --js main.scala --js-module-kind none --output dist/bundle.js
```

`--js-module-kind none` is passed explicitly for clarity even though
NoModule (plain global-scope script) is already Scala.js's default - this
is exactly why `@JSExportTopLevel` works with a plain `<script>` tag here
with no extra bundler: the exported name becomes an actual top-level JS
variable, not a module export. If this command's flags don't match your
installed scala-cli version's exact syntax, `scala-cli --power package --js
--help` will show the current option names - the important invariant to
preserve is a single, non-module, script-tag-loadable `.js` output file.

**Acceptance check:** same-region ticks show real tab-bar DOM churn - the
three tab `div`s get destroyed and recreated every single tick, even though
region never changed. Confirm this visually via the flash (all three tabs
should flash on every Apply, not just on region-switch ticks) before moving
to Task 8 - if the tab bar does NOT churn on same-region ticks, this task
hasn't reproduced the bug and needs revisiting.

### Task 8 - `laminar-fixed`

Identical to Task 7 (same `//> using` header, same scaffold, same
`decodeState`/`renderFlightRow`) except for the tab-bar wiring: unbundle
region into its own `.distinct`-ed signal, and update `cls` on tab elements
created once, rather than replacing the whole tab bar.

```scala
// implementations/laminar-fixed/main.scala - same header/decoders as Task 7

@JSExportTopLevel("__VDOM_DEMO_MOUNT__")
def mount(container: dom.Element, initialStateJs: js.Any): js.Object = {
  val stateVar = Var(decodeState(initialStateJs))
  val regionSignal = stateVar.signal.map(_.region).distinct   // <-- the fix
  val flightsSignal = stateVar.signal.map(_.flights)

  val app: Div =
    div(
      div(cls := "vdom-tabs",
        List("Europe", "Africa", "Asia").map(r =>
          div(cls <-- regionSignal.map(cur => s"vdom-tab${if (r == cur) " active" else ""}"))
        )
      ),
      table(cls := "vdom-table",
        thead(tr(th("Flight"), th("Status"), th("Last ping"))),
        tbody(children <-- flightsSignal.map(_.map(renderFlightRow)))
      )
    )

  render(container, app)
  js.Dynamic.literal(update = (newStateJs: js.Any) => stateVar.set(decodeState(newStateJs)): Unit)
}
```

Package the same way as Task 7 (`scala-cli --power package --js main.scala
--js-module-kind none --output dist/bundle.js`).

**Acceptance check:** same-region ticks show zero tab-bar mutations and no
flash on the tab elements - only the flight table flashes. This is the
comparison the whole talk hinges on: run `laminar-naive` and `laminar-fixed`
back to back on the identical sequence and confirm the same-region counters
diverge sharply, ideally more than the gap between any two of the other five
frameworks.

---

## 8. Build & serve everything together

1. Run each implementation's own production build (`npm run build` /
   `elm make ... --optimize` / `scala-cli --power package --js ...`), and
   confirm each produces `implementations/<name>/dist/index.html` plus a JS
   bundle it references.
2. From the repo root, run a static file server (`npx serve .` or
   equivalent) - do not serve from inside any individual implementation's
   directory, or the harness's relative paths will break.
3. Open the top-level `index.html`, click through all 8 links, confirm each
   one's Apply button works and counters move.

---

## 9. Definition of done

- [ ] `node harness/sequence/generate.mjs` reproduces `sequence.json` exactly,
      and every entry has a `kind` field
- [ ] All 8 implementations build with no errors and no console errors at runtime
- [ ] All 8 render visually identically (same table/tab styling) - only the
      counters/flash differ
- [ ] `vanilla`'s same-region mutation count is the largest of all eight, by
      a wide margin
- [ ] `react-compiled`'s same-region count is measurably lower than
      `react-naive`'s, and the build output confirms the compiler actually ran
- [ ] `elm`'s same-region count shows zero tab-bar churn (confirmed by
      temporarily removing `lazy` and seeing the count rise)
- [ ] `solid`'s same-region `ping` ticks show single-digit mutation counts,
      not counts approaching the naive full-tree size (confirms `reconcile`
      is preserving identity correctly - see Task 5's known-issue callout)
- [ ] `svelte` shows zero tab-bar mutations on same-region ticks
- [ ] `laminar-naive` visibly rebuilds the tab bar on every tick, including
      same-region ticks
- [ ] `laminar-fixed` shows zero tab-bar mutations on same-region ticks,
      using the identical sequence as `laminar-naive`
- [ ] reorder-only ticks (check `sequence.json` for steps where region and
      flight set are unchanged but order differs) produce a visibly
      different mutation pattern in at least the vanilla and one VDOM
      implementation, versus a pure `ping` tick
- [ ] `VERSIONS.md` at the repo root records the actual installed version of
      every tool in Section 1's pinned-versions table, filled in from what
      you actually used, not copied from this spec unread
