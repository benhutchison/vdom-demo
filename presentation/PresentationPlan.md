  Title

  # VDOM or not VDOM?
  # A survey of incremental UI updates in React, Elm, Svelte, SolidJS, and Laminar

  ## The problem —

  What does "incremental update" mean?
  Data changes → the screen has to reflect it
  Naive answer: re-render everything. Doesn't scale.
  The real challenge: doing only the necessary work
  Why DOM edits aren't free
  A mutation can trigger style recalc → layout → paint → composite
  innerHTML = doesn't just rewrite text — it destroys every child, drops event listeners, loses focus/scroll state
  [DIAGRAM: browser rendering pipeline triggered by a mutation]
  Most changes touch a tiny fraction of the screen
  One flight's last-ping time updates. A validation error appears, then clears.
  [DIAGRAM/MOCKUP: full UI, one small region highlighted as the actual delta]

  ## Virtual DOM 

  What a Virtual DOM actually does
  Build a lightweight description of the UI, diff old vs. new, patch only what changed
  [DIAGRAM: VDOM diff process — old tree / new tree / diff / patch]

  The pitch: write it as if nothing is incremental. Describe the whole UI as a function of the whole state, every time — no diffing logic, no tracking what changed, in the code you write. The framework derives the incremental update for you, automatically, from that non-incremental description. The cost: some UI representation gets generated and thrown away unused.
  Who uses it: 
  - React (Fiber; Compiler now auto-memoizes what you used to write by hand) 
  - Elm (virtual-dom + Html.Lazy)

  ## The alternative: fine-grained reactivity 

  The idea, as simply as possible: track, precisely, which bits of the UI depend on which bits of state. When a piece of state changes, go straight to the UI that depends on that specific piece — nothing else is even considered.
  Who uses it: Solid.js, Svelte 5, Laminar
  A sharp knife, not a safety scissor. Done right, more efficient than a VDOM ever can be. Done wrong — bundle the wrong data together, or misjudge how your data actually changes — and it's easy to accidentally rebuild everything anyway, with none of the VDOM's built-in protection against that mistake.

  ## Interval

  ## Before the demo 

  What to watch for (said once here, confirmed again at the end — deliberately):
  VDOM: convenience and safety by default, paid for in some wasted generation
  Signals: real efficiency, but only as good as your understanding of your own data's shape and rate of change

  ## Demo 

  The setup: one scripted sequence, one UI, 10 implementations, real-time node-mutation counts
  The workload, chosen deliberately (pings dominant, structural changes rare — the realism rationale)
  [SHOW] The landing page — links to all 10 implementations and the full repo. "Don't take my word for it — check or challenge any of this yourselves."
  15–21. 
  [LIVE] One full walkthrough — e.g. Laminar fixed — to show keyed rows and field-scoped cell updates end to end

  ## Frameworks Examined

  One slide per framework (not a live demo) — history (who, when, where) + how it works + the one interesting finding:
  - React (Jordan Walke, Facebook, prototyped 2011 → open-sourced May 2013) — VDOM + Fiber; Compiler makes no visible difference here, because the VDOM had already solved the DOM-churn problem before the Compiler entered the picture
  - Elm (Evan Czaplicki, 2012, Harvard thesis → Prezi → NoRedInk) — virtual-dom + Html.Lazy
  - Svelte (Rich Harris, Thanksgiving 2016, while at The Guardian US; Svelte 3/2019 = the real "no VDOM" rewrite) — compiled runes; [if built] naive (unkeyed {#each}) vs. fixed — position-matching gone wrong
  - Solid.js (Ryan Carniato, started 2015 → open-sourced 2018) — signals/stores, compiled; fixed (`createStore` + `reconcile`) vs. flawed (plain signal passes fresh objects to `<For>`) — identity determines whether rows are reused
  - Laminar (Nikita Gazarov, ~2016 onward) — Airstream FRP; naive (bundled state rebuilds tabs), flawed (`.distinct` tabs but unkeyed rows), fixed (`split(_.id)` keyed rows and distinct cell fields) — isolating state and preserving row identity are separate steps

  ## Results

  All counts below come from the shared deterministic 40-row workload. The original eight implementations were each measured over 120 updates (108 same-region, 12 region switches). `solid-flawed` was then measured over the same 120 updates. The keyed `laminar-fixed` figures are from its recorded 60-update run (54 same-region, 6 region switches), so keep its run size visible when comparing totals.

  | Implementation | Run | Naive tree | Same-region nodes (ticks; avg/tick) | Region-switch nodes (ticks; avg/tick) | Total nodes | Avg/tick |
  |---|---:|---:|---:|---:|---:|---:|
  | vanilla | 120 updates | 172 | 37,056 (108; 343.1) | 4,128 (12; 344.0) | **41,184** | **343.2** |
  | laminar-naive | 120 updates | 174 | 35,760 (108; 331.1) | 3,984 (12; 332.0) | **39,744** | **331.2** |
  | laminar-flawed (tabs isolated, rows unkeyed) | 120 updates | 173 | 34,464 (108; 319.1) | 3,876 (12; 323.0) | **38,340** | **319.5** |
  | laminar-fixed (keyed rows) | 60 updates | 173 | 166 (54; 3.1) | 645 (6; 107.5) | **811** | **13.5** |
  | elm | 120 updates | 173 | 642 (108; 5.9) | 1,238 (12; 103.2) | **1,880** | **15.7** |
  | solid | 120 updates | 172 | 356 (108; 3.3) | 1,292 (12; 107.7) | **1,648** | **13.7** |
  | solid-flawed (fresh objects to `<For>`) | 120 updates | 172 | 34,464 (108; 319.1) | 3,876 (12; 323.0) | **38,340** | **319.5** |
  | react-naive | 120 updates | 172 | 324 (108; 3.0) | 1,286 (12; 107.2) | **1,610** | **13.4** |
  | react-compiled | 120 updates | 172 | 324 (108; 3.0) | 1,286 (12; 107.2) | **1,610** | **13.4** |
  | svelte | 120 updates | 172 | 308 (108; 2.9) | 1,274 (12; 106.2) | **1,582** | **13.2** |

  Key result: the two flawed identity/list variants land at 319.5 nodes per tick, close to full row rebuilding. Keyed Laminar averages 3.1 same-region mutations per tick; Solid fixed averages 3.3. The region-switch counts are expectedly much higher because all 40 displayed flights change.

  ## Closing Remarks

  Trade-offs, not a winner — VDOM's convenience/waste trade restated as a conclusion now, not a hypothesis; signals' sharp-knife framing likewise
  Still not settled — each camp visibly borrowing from the other
  Thank you! Questions?

  ## Appendix (only if asked) —

  Incremental computation beyond the browser — build systems, spreadsheets, self-adjusting computation, the Jane Street piece