# SpecUpdate.md — changes to apply to the existing vdom-demo codebase

**Baseline:** this describes changes against the codebase as already built
from `SPEC.md` (the version without timestamped `lastPing`, without the
"Region" tab label, and without a batched-ping workload). Apply these as
modifications to what's already there — this is not a replacement spec,
and most of the existing code (harness instrumentation, the mount
contract, the Elm/Laminar/Solid-specific fixes already in place) is
unaffected and should be left alone.

Two unrelated changes are bundled into this update:

1. **`lastPing` becomes a readable timestamp, and the region tabs get a
   visual/labeling pass.** (Sections 1–4 below)
2. **A new, explicitly-described simulated workload**, including a new
   coalesced "ping batch" transition kind, and a critical rebalancing of
   how often each kind of change occurs. (Sections 5–7 below)

Also resolved: **the React Compiler task (`react-compiled`) is being kept**
— see Section 8. Don't drop it, and don't wait on a further decision.

---

## 1. Data model change: `lastPing` is now a string, not a number

```ts
type Flight = {
  id: string;
  flightNum: string;
  status: "Airborne" | "Landed";
  lastPing: string;   // was: number. Now "HH:MM:SS" - pre-formatted, display as-is.
};
```

Rationale: a raw incrementing counter starting at `0` is unintuitive for an
audience — "last heard from this plane at 09:14:32" reads immediately,
"last ping: 7" does not. The value is produced by a **simulated clock** in
the generator (Section 6), not `Date.now()` — deliberately, for two
reasons: the generator is seeded/deterministic and real wall-clock time
would break that, and a live, continuously-ticking clock would mean the
displayed value (and therefore the DOM) changes on its own, independent of
clicking Apply — which would quietly undermine the entire premise of a
demo built around "mutations only happen in response to a click." The
simulated clock advances only when a flight is actually pinged, and never
otherwise.

Every implementation just displays `f.lastPing` exactly as given — no
implementation does any date/time formatting itself. The only places that
need real code changes are the two that declare an actual type for this
field:

**Elm** (`Main.elm`):
- `type alias Flight = { ..., lastPing : String }` (was `Int`)
- `flightDecoder`'s last field: `(D.field "lastPing" D.string)` (was `D.int`)
- in `viewFlightTable`, the cell becomes `td [] [ text f.lastPing ]` — drop
  the `String.fromInt` wrapper, it's already a string

**Both Laminar variants** (`laminar-naive/main.scala`, `laminar-fixed/main.scala`):
- `case class Flight(..., lastPing: String)` (was `Int`)
- in `decodeState`: `f.lastPing.asInstanceOf[String]` (was `.asInstanceOf[Int]`)
- in `renderFlightRow`: `td(f.lastPing)` (was `td(f.lastPing.toString)`)

Vanilla, both React variants, Solid, and Svelte need **no code changes** —
`{f.lastPing}` / `${f.lastPing}` already displays a string or a number
identically.

---

## 2. Region tabs: look more like tabs (CSS-only)

Replace the existing `.vdom-tabs` / `.vdom-tab` rules in `harness/harness.css`
with:

```css
.vdom-tabs-label { font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 4px; }
.vdom-tabs { display: flex; gap: 4px; border-bottom: 2px solid #333; margin-bottom: 0; }
.vdom-tab {
  padding: 8px 18px;
  border: 1px solid #ccc;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
  background: #e8e8e8;
  color: #555;
  margin-bottom: -2px; /* sit on top of .vdom-tabs' bottom border */
}
.vdom-tab.active {
  background: white;
  color: #111;
  font-weight: bold;
  border-color: #333;
  border-bottom: 2px solid white; /* merges into the (white) content area below */
}
```

Also add, just below the table rules:

```css
.vdom-table { margin-top: 8px; }
```

(so the table isn't jammed directly against the tab row now that it has a
visible baseline). This needs **no implementation code changes** — every
implementation already applies these exact class names.

---

## 3. Region tabs: add a "Region" label

New markup, not just styling — one static line in each implementation,
immediately before the existing `.vdom-tabs` element. The label text is
always `"Region"` and never changes, so in both Laminar variants it should
be created as plain static markup, not bound to any signal.

**Vanilla** (`main.js`, inside `render()`):
```js
return `<div class="vdom-tabs-label">Region</div>
  <div class="vdom-tabs">${tabs}</div>
  <table class="vdom-table">...`;
```

**React** (both variants, `TabBar`):
```jsx
function TabBar({ region }) {
  return (
    <>
      <div className="vdom-tabs-label">Region</div>
      <div className="vdom-tabs">
        {["Europe", "Africa", "Asia"].map(r =>
          <div key={r} className={`vdom-tab ${r === region ? "active" : ""}`}>{r}</div>)}
      </div>
    </>
  );
}
```

**Elm** (`viewTabBar`):
```elm
viewTabBar : String -> Html Msg
viewTabBar region =
    div []
        [ div [ class "vdom-tabs-label" ] [ text "Region" ]
        , div [ class "vdom-tabs" ]
            (List.map (\r -> div [ class ("vdom-tab" ++ (if r == region then " active" else "")) ] [ text r ])
                [ "Europe", "Africa", "Asia" ])
        ]
```

**Svelte** (`App.svelte`, before the existing `.vdom-tabs` div):
```svelte
<div class="vdom-tabs-label">Region</div>
<div class="vdom-tabs">
  ...unchanged...
</div>
```

**Laminar naive** (`renderTabBar` — note the function now returns a wrapper
`div` containing the label too, so the whole thing — label included — gets
torn down and rebuilt on every tick, consistent with what this
implementation is supposed to demonstrate):
```scala
def renderTabBar(region: String): Div =
  div(
    div(cls := "vdom-tabs-label", "Region"),
    div(cls := "vdom-tabs",
      List("Europe", "Africa", "Asia").map(r =>
        div(cls := s"vdom-tab${if (r == region) " active" else ""}", r)))
  )
```

**Laminar fixed** (inline in `mount`, label created once, never touched by
any signal — this is the point of this variant):
```scala
div(
  div(cls := "vdom-tabs-label", "Region"), // static - never touched by any signal
  div(cls := "vdom-tabs",
    List("Europe", "Africa", "Asia").map(r =>
      div(cls <-- regionSignal.map(cur => s"vdom-tab${if (r == cur) " active" else ""}"))
    )
  ),
  // ...rest unchanged...
)
```

**Solid** — handled for you. `implementations/solid/src/main.jsx` is
re-issued as an updated external artifact with this label added; copy it
in verbatim, same as before.

---

## 4. Acceptance checks to add for Sections 1–3

- `lastPing` displays as `HH:MM:SS` everywhere, never a bare number.
- The tabs visually read as tabs (connected baseline, active tab merging
  into the content below) in every implementation.
- The word "Region" appears above the tab row in every implementation.
- In `laminar-naive`, the "Region" label flashes/rebuilds on every tick
  (same-region included) along with the rest of the tab bar. In
  `laminar-fixed`, it never flashes at all.

---

## 5. The simulated workload — new prose section for SPEC.md

Insert this as its own section, positioned right before the generator code
(currently "6.1 Sequence generator") — it's the rationale for what that
code does, and deserves to be explicit rather than left implicit in code
comments. Renumber subsequent sections when you fold this in.

> ### The simulated workload
>
> Every implementation is judged against the exact same scripted sequence
> of state changes, so this sequence *is* the yardstick the whole demo
> rests on — it deserves to be chosen deliberately and described
> explicitly, not left as an implementation detail buried in a generator
> script.
>
> Seven kinds of change occur, each stressing a different aspect of
> incremental update handling:
>
> | Kind | What it represents | What it stresses | Relative frequency |
> |---|---|---|---|
> | `ping` | One flight's last-contact time updates | The minimal case: does the implementation touch exactly one cell, or more? | Common |
> | `pingBatch` | Three different flights' last-contact times update together, in one tick | Coalesced updates — real systems commonly batch several independent events that land within the same processing window. Does the implementation handle three simultaneous small changes as three small changes, or does it lump them into something coarser? | **Most common** |
> | `statusFlip` | One flight transitions Airborne → Landed | A different field on the same row changing — does the implementation distinguish *which field* changed, not just *which row*? | Rare |
> | `add` | A new flight appears (always Airborne) | Structural growth, and whether new rows are added surgically or trigger wider re-rendering | Occasional |
> | `remove` | A flight leaves (preferentially one that's Landed) | Structural shrinkage — and, combined with `add` at a matched frequency, keeps the row count roughly stable over a long run rather than drifting | Occasional, balanced with `add` |
> | `reorder` | The same flights, repositioned | Whether existing DOM nodes are moved, or destroyed and recreated, when identity is preserved but position isn't | Rare |
> | `regionSwitch` | The visible region changes entirely | The one case where touching a lot of the screen is *correct*, not wasteful — a check that implementations don't over-optimize into never updating anything | Rare (roughly 1 in 9 ticks) |
>
> **Why pings dominate.** In a real flight-tracking system, aircraft report
> their position continuously and independently — with dozens of aircraft
> each pinging every few seconds, it would be unusual for a given
> rendering window to contain *no* pings, and in practice several
> aircraft's updates landing in the same window (a `pingBatch`) is the
> common case, not the exception; an isolated single-flight `ping` is
> the less frequent case, representing the moments where coalescing
> happens not to occur. Structural changes — a flight entering or leaving
> the tracked region, landing, or the list being resequenced — are
> comparatively rare events against that backdrop. The generator reflects
> this: pings (batched and single, combined) make up roughly 60% of
> ticks, structural changes the remaining 40%, split evenly across the
> four structural kinds.
>
> **A deliberate departure from strict realism.** A fully realistic
> simulation would likely skew even further toward batched pings, to the
> point where an isolated single-flight ping becomes a minor edge case
> rather than a clearly-represented category. We've kept `ping` and
> `pingBatch` as distinct, comparably-sized categories on purpose, because
> the demo's job is to make the *contrast* between "one thing changed" and
> "several things changed at once" legible to an audience watching counts
> on a screen — pedagogical clarity won out over strict traffic-pattern
> accuracy here, and that trade-off is worth being upfront about rather
> than presenting the frequencies as a literal traffic model.
>
> **Flights now follow a simple one-way lifecycle**, rather than every
> field being an independent coin-flip on every step: a flight is created
> Airborne, can flip to Landed at most once (never the reverse — aircraft
> don't un-land), and `remove` preferentially selects a Landed flight when
> one is available. This is a deliberate simplification short of full
> realism — in a fuller simulation, landing and removal would likely be
> causally linked (a flight gets removed *because* it landed and taxied
> off the tracked board, probably soon after) rather than two independently
> rolled events that merely share a preference for the same kind of
> flight. We judged that full causal link not worth the added generator
> complexity for what this demo needs to show, and are naming it here as a
> known, accepted gap rather than leaving it unexamined.
>
> (This one-way rule applies within a single region's continuous run — a
> region switch starts a fresh flight list with a new random mix of
> statuses, so an id that was Landed in one region can appear Airborne in
> the next; that's a new flight, not a reversal.)
>
> **`reorder` is kept intentionally simple and independent** — modeled as
> an occasional resequencing unrelated to any other field (e.g., as if
> some other sort criterion elsewhere in the system occasionally changes),
> rather than derived from sorting by any of our own fields. Tying it to,
> say, "re-sort by most recent ping" would have made it far more frequent
> and entangled with the `ping`/`pingBatch` story in ways that would
> muddy rather than sharpen the comparison.
>
> **`regionSwitch` frequency is unchanged from the original design** (every
> 9th tick by default) — it represents the presenter/operator occasionally
> switching focus, which should be clearly rarer than the data ticking over
> underneath whichever region is currently showing.

---

## 6. Generator changes: `pingBatch` kind + rebalanced frequencies + flight lifecycle

Full replacement for `harness/sequence/generate.mjs` (the clock-simulation
parts are unchanged from the timestamp work in Section 1; what's new here
is the `pingBatch` case, the rebalanced `RECIPE`, and the one-way flight
lifecycle):

```js
// harness/sequence/generate.mjs
// Run: node generate.mjs [--rows=40] [--steps=60] [--switchEvery=9] [--seed=20260731] > sequence.json

const REGIONS = ["Europe", "Africa", "Asia"];
const SIM_CLOCK_START_MS = Date.UTC(2026, 0, 1, 9, 0, 0); // fixed, arbitrary anchor - not tied to real time

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

// Formats a simulated-clock millisecond value as "HH:MM:SS". Uses UTC
// getters deliberately - local-time getters would make the output depend
// on the generating machine's timezone, breaking reproducibility.
function formatTime(ms) {
  const d = new Date(ms);
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

// Advances the shared simulated clock by a random 5-45 "seconds" and
// returns the new value, formatted. `clock` is a mutable { ms } carried
// through generation, same pattern as the `nextId` counter below.
function advanceClock(rng, clock) {
  clock.ms += 5000 + Math.floor(rng() * 40000);
  return formatTime(clock.ms);
}

// opts.forceAirborne: used for `add` events, where a newly-appearing
// flight should always start Airborne. initialFlights (seeding a fresh
// snapshot of ongoing traffic) omits it, so those get a random mix - some
// already Landed, some already Airborne, representing a slice of traffic
// already in progress.
function makeFlight(rng, clock, id, opts = {}) {
  return {
    id,
    flightNum: `FL${100 + Math.floor(rng() * 900)}`,
    status: opts.forceAirborne ? "Airborne" : (rng() < 0.5 ? "Airborne" : "Landed"),
    lastPing: advanceClock(rng, clock),
  };
}

function initialFlights(rng, clock, rows) {
  return Array.from({ length: rows }, (_, i) => makeFlight(rng, clock, `f${i}`));
}

// Rebalanced recipe: pings (batched + single) dominate at roughly 60%,
// with the four structural kinds splitting the remaining 40% evenly. See
// "The simulated workload" in SPEC.md for the full rationale.
const RECIPE = [
  "pingBatch", "ping", "pingBatch", "statusFlip",
  "pingBatch", "add", "pingBatch", "remove",
  "ping", "reorder",
];

function applyStep(rng, clock, prevFlights, kind, nextId) {
  let flights = prevFlights.map(f => ({ ...f }));
  switch (kind) {
    case "ping": {
      const i = Math.floor(rng() * flights.length);
      flights[i] = { ...flights[i], lastPing: advanceClock(rng, clock) };
      break;
    }
    case "pingBatch": {
      // 3 distinct flights, each getting its own independently-advanced
      // timestamp - not all 3 sharing one instant, since each flight's
      // actual last-contact moment is independent; "batch" here means
      // "processed together in one tick," not "happened at one instant."
      const batchSize = Math.min(3, flights.length);
      const chosen = new Set();
      while (chosen.size < batchSize) chosen.add(Math.floor(rng() * flights.length));
      for (const i of chosen) {
        flights[i] = { ...flights[i], lastPing: advanceClock(rng, clock) };
      }
      break;
    }
    case "statusFlip": {
      // One-way lifecycle: only ever Airborne -> Landed, never the
      // reverse. If nothing is currently Airborne, fall back to a ping
      // rather than silently doing nothing this step.
      const airborneIdxs = flights
        .map((f, i) => [f, i])
        .filter(([f]) => f.status === "Airborne")
        .map(([, i]) => i);
      if (airborneIdxs.length === 0) {
        const i = Math.floor(rng() * flights.length);
        flights[i] = { ...flights[i], lastPing: advanceClock(rng, clock) };
      } else {
        const i = airborneIdxs[Math.floor(rng() * airborneIdxs.length)];
        flights[i] = { ...flights[i], status: "Landed" };
      }
      break;
    }
    case "add": {
      flights.push(makeFlight(rng, clock, `f${nextId.n++}`, { forceAirborne: true }));
      break;
    }
    case "remove": {
      if (flights.length > 3) {
        // Prefer removing a Landed flight (a flight that's left the
        // active board, having already landed) - fall back to any flight
        // if none are currently Landed.
        const landedIdxs = flights
          .map((f, i) => [f, i])
          .filter(([f]) => f.status === "Landed")
          .map(([, i]) => i);
        const i = landedIdxs.length > 0
          ? landedIdxs[Math.floor(rng() * landedIdxs.length)]
          : Math.floor(rng() * flights.length);
        flights.splice(i, 1);
      }
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
  const clock = { ms: SIM_CLOCK_START_MS };
  let region = REGIONS[0];
  let flights = initialFlights(rng, clock, rows);
  const nextId = { n: rows };
  const sequence = [{ region, flights, kind: "initial" }];

  for (let s = 0; s < steps; s++) {
    let kind;
    if ((s + 1) % switchEvery === 0) {
      const others = REGIONS.filter(r => r !== region);
      region = others[Math.floor(rng() * others.length)];
      flights = initialFlights(rng, clock, rows); // a region switch means a whole new flight list
      kind = "regionSwitch";
    } else {
      kind = RECIPE[s % RECIPE.length];
      flights = applyStep(rng, clock, flights, kind, nextId);
    }
    sequence.push({ region, flights: flights.map(f => ({ ...f })), kind });
  }
  return sequence;
}

const config = parseArgs();
process.stdout.write(JSON.stringify({ config, sequence: generate(config) }, null, 2));
```

**Acceptance check:** regenerate `sequence.json`
(`node generate.mjs > sequence.json`), then confirm:
- a `pingBatch` tally shows up in the `kind` distribution
  (`grep -o '"kind": *"[a-zA-Z]*"' sequence.json | sort | uniq -c`), at
  roughly 4x the frequency of `remove`/`add`/`statusFlip`/`reorder`
- no flight ever shows `status` flipping from `Landed` back to `Airborne`
  across consecutive steps for the same `id` within a single region's
  continuous run (region switches regenerate the whole flight list with a
  fresh random mix of statuses, so ids are reused across them — that's a
  new flight, not a lifecycle reversal)
- every newly-`add`ed flight (one not present in the previous step) starts
  as `Airborne`

**Implementations need no code changes for this section.** `pingBatch` is
purely generator/harness-level metadata — every implementation receives a
complete `State` object either way, and reconciling "3 cells changed" is
no different in kind from reconciling "1 cell changed." This is the
mount-contract design (full state, not diffs) paying off: a new workload
shape didn't require touching eight codebases, only one generator script.

---

## 7. Harness changes: label the new kind, fix stale wording

`harness/harness.js` is re-issued as an updated external artifact — copy
it in verbatim. The only change from the previous version is to
`KIND_LABELS`:

```js
const KIND_LABELS = {
  initial: "Initial state",
  ping: "Ping (one flight's last-ping time updated)",
  pingBatch: "Ping batch (3 flights' last-ping times updated together)",
  statusFlip: "Status flip (one flight transitioned Airborne → Landed)",
  add: "Flight added (new, Airborne)",
  remove: "Flight removed (a Landed flight leaving the board)",
  reorder: "Rows reordered (same flights, new order)",
  regionSwitch: "Region switch",
};
```

Two things fixed here, not just the addition: the `ping` label used to say
"last-ping counter ticked," which was already stale wording left over from
before `lastPing` became a timestamp (Section 1) — now corrected to "time
updated." And `statusFlip`/`add`/`remove`'s labels are updated to reflect
the one-way lifecycle from Section 6, rather than describing a generic,
reversible toggle.

No other part of `harness.js` changes - the metrics tracking, the
`MutationObserver` wiring, the glossary, and the flash logic are all
unaffected by a new `kind` value; `sameRegion`/`regionSwitch` bucketing is
unaffected too, since that's derived from comparing region values
directly, not from `kind`.

**Acceptance check:** a `pingBatch` tick's "Last update" readout shows the
new label and a mutation count close to 3x a plain `ping` tick's (for any
implementation that correctly isolates changes to just the affected
cells) - not a full-table rebuild, and not identical to a single `ping`.

---

## 8. Resolved: keep `react-compiled`

Section 2 of the previous spec flagged this as an open decision, since
testing showed no visible difference between `react-naive` and
`react-compiled` on the demo's DOM-mutation metric. Decision: **keep
both.** Rationale, for the record: avoiding unnecessary DOM writes isn't
the only axis of optimization that matters — avoiding unnecessary *virtual
DOM* recomputation is a distinct, additional one, and this pair is a
useful standing reminder of that even though the current metrics don't
make the difference visible. The demo may be extended later (a
component-invocation counter, as discussed previously) to actually
surface it, but that's a future enhancement, not a blocker — don't treat
this task as pending any further, and don't wait on an invocation counter
before building it.

Update the Definition of Done item that previously read "The React
Compiler question in Task 3 has been explicitly decided" — replace it
with: "`react-compiled` is built and kept per Section 2's note; no
DOM-mutation-count difference from `react-naive` is expected or required."
