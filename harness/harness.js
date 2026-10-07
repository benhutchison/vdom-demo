// harness/harness.js - loaded identically by every implementation's index.html
(function () {
  const FLASH_CLASS = "vdom-demo-flash";
  const FLASH_MS = 400;
  const DEFAULT_SETTLE_DELAY_MS = 50; // see the timing note in SPEC.md - tune per-implementation via init(), not here

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

  // Plain-language definitions, shown in the on-page glossary and as native
  // title-attribute tooltips. Keep these audience-facing, not developer-facing.
  const GLOSSARY = [
    {
      id: "glossary-rows",
      term: "Row count",
      body: "How many flight rows are in the table right now. The demo was generated with a fixed configured row count, but add/remove updates can change the live count as it runs.",
    },
    {
      id: "glossary-naive",
      term: "Naive full-tree size",
      body: "If this update had rebuilt everything from scratch - the crudest possible approach, like replacing the whole table's HTML every time - this is how many DOM nodes it would have to touch. It's the worst-case yardstick every other number on this page is compared against.",
    },
    {
      id: "glossary-same-region",
      term: "Same-region ticks",
      body: "Updates where the flight data changed but the currently-selected region tab did not. This is the common case - data ticking over while you stay on the same screen - and it's the number that most reveals whether a framework is doing unnecessary work.",
    },
    {
      id: "glossary-switch",
      term: "Region-switch ticks",
      body: "Updates where the region itself changed, like clicking to a different tab. Expect these numbers to be noticeably bigger than the same-region numbers for every implementation, since the whole visible table is genuinely different - that's normal, not a bug.",
    },
    {
      id: "glossary-last",
      term: "Last update",
      body: "What kind of change just happened on the most recent click, and how many real DOM nodes it touched. This is the number to watch immediately after each click, before it gets folded into the running totals below.",
    },
  ];

  // Counts an element plus all of its descendant elements, mirroring exactly
  // what container.querySelectorAll('*') counts elsewhere - so a newly added
  // <tr> with three <td>s inside contributes 4, matching how "naive full-tree
  // size" would count that same subtree if it had been built from scratch.
  // Text/comment nodes contribute nothing here, same as querySelectorAll('*').
  function collectElements(node, into) {
    if (node.nodeType !== 1) return;
    into.add(node);
    node.querySelectorAll("*").forEach(d => into.add(d));
  }

  function attachObserver(container) {
    let touched = new Set();

    const obs = new MutationObserver(muts => {
      const flashTargets = new Set();

      for (const m of muts) {
        if (m.type === "childList") {
          // m.target here is the PARENT that children were added to/removed
          // from, not the changed node itself - the actual nodes are in
          // addedNodes/removedNodes. Counting m.target would silently
          // undercount (one parent, regardless of how many children changed)
          // and flash the wrong element (the whole container, not the row).
          m.addedNodes.forEach(n => {
            collectElements(n, touched);
            if (n.nodeType === 1) flashTargets.add(n); // flash the row itself; its background covers its own cells
          });
          m.removedNodes.forEach(n => {
            collectElements(n, touched); // still counted - removal is a real DOM cost - nothing to flash, it's detached
          });
        } else {
          // attributes / characterData: m.target IS the changed thing (or,
          // for characterData, the Text node whose parent is what we can
          // actually flash, since only Elements have classList).
          const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
          if (!el) continue;
          touched.add(el);
          flashTargets.add(el);
        }
      }

      if (flashTargets.size === 0) return;

      // Disconnect once for the whole batch before touching classList, so
      // adding FLASH_CLASS doesn't itself queue attribute mutations that
      // would re-trigger this same callback (attributes: true is being
      // observed, so classList changes count as mutations too).
      obs.disconnect();
      flashTargets.forEach(el => el.classList.add(FLASH_CLASS));
      obs.observe(container, { childList: true, subtree: true, attributes: true, characterData: true });

      setTimeout(() => {
        obs.disconnect();
        flashTargets.forEach(el => el.classList.remove(FLASH_CLASS));
        obs.observe(container, { childList: true, subtree: true, attributes: true, characterData: true });
      }, FLASH_MS);
    });

    obs.observe(container, { childList: true, subtree: true, attributes: true, characterData: true });
    return { reset: () => (touched = new Set()), count: () => touched.size };
  }

  function fmtAvg(total, ticks) {
    return ticks === 0 ? "-" : (total / ticks).toFixed(1);
  }

  function metricRow(label, value, glossaryId, sub) {
    const tooltip = (GLOSSARY.find(g => g.id === glossaryId) || {}).body || "";
    return `
      <div class="vdom-metric">
        <span class="vdom-metric-label">
          ${label}
          <a class="vdom-info" href="#${glossaryId}" title="${tooltip.replace(/"/g, "&quot;")}">ⓘ</a>
        </span>
        <span class="vdom-metric-value">${value}</span>
        ${sub ? `<span class="vdom-metric-sub">${sub}</span>` : ""}
      </div>`;
  }

  async function init({
    mount,
    containerId = "app-root",
    sequenceUrl = "../../../harness/sequence/sequence.json",
    settleDelayMs = DEFAULT_SETTLE_DELAY_MS, // override per-implementation if a framework needs longer
  }) {
    const { config, sequence } = await (await fetch(sequenceUrl)).json();
    const container = document.getElementById(containerId);
    const upper = document.getElementById("vdom-demo-upper");

    let step = 0;
    const sameRegion = { ticks: 0, mutations: 0 };
    const regionSwitch = { ticks: 0, mutations: 0 };
    let lastTick = { kind: sequence[0].kind, mutations: 0 };

    const instance = mount(container, sequence[0]);
    const observer = attachObserver(container);

    function renderUpper() {
      const cur = sequence[step];
      const next = sequence[Math.min(step + 1, sequence.length - 1)];
      const atEnd = step + 1 >= sequence.length;
      const naiveSize = container.querySelectorAll("*").length;

      upper.innerHTML = `
        <div class="vdom-demo-upperrow">
          <button id="vdom-demo-apply" ${atEnd ? "disabled" : ""}>Apply →</button>
          <div><strong>Current</strong> - ${cur.region}, ${cur.flights.length} flights</div>
          <div><strong>Next</strong> - ${next.region}, ${next.flights.length} flights
            <span class="vdom-next-kind">(${KIND_LABELS[next.kind] || next.kind})</span></div>
        </div>

        <div class="vdom-demo-metrics">
          ${metricRow("Row count", `${cur.flights.length}`, "glossary-rows",
              `configured for this run: ${config.rows}`)}
          ${metricRow("Naive full-tree size", `${naiveSize} nodes`, "glossary-naive")}
          ${metricRow("Last update", `${lastTick.mutations} nodes touched`, "glossary-last",
              KIND_LABELS[lastTick.kind] || lastTick.kind)}
          ${metricRow("Same-region ticks", `${sameRegion.ticks} so far`, "glossary-same-region",
              `${sameRegion.mutations} nodes total, avg ${fmtAvg(sameRegion.mutations, sameRegion.ticks)}/tick`)}
          ${metricRow("Region-switch ticks", `${regionSwitch.ticks} so far`, "glossary-switch",
              `${regionSwitch.mutations} nodes total, avg ${fmtAvg(regionSwitch.mutations, regionSwitch.ticks)}/tick`)}
        </div>

        <details class="vdom-glossary">
          <summary>What do these numbers mean?</summary>
          <dl>
            ${GLOSSARY.map(g => `<div id="${g.id}"><dt>${g.term}</dt><dd>${g.body}</dd></div>`).join("")}
          </dl>
        </details>`;

      const btn = document.getElementById("vdom-demo-apply");
      if (btn) btn.onclick = applyNext;
    }

    function applyNext() {
      if (step + 1 >= sequence.length) return;
      const nextEntry = sequence[step + 1];
      // Ground truth for bucketing is the actual region values, not the
      // generator's kind label - this way counting stays correct even if
      // sequence.json is regenerated with a different recipe, or kind is
      // ever missing/stale for some other reason.
      const isSwitch = sequence[step].region !== nextEntry.region;

      observer.reset();
      instance.update(nextEntry);
      // Double rAF gets us past most frameworks' commit timing; the extra
      // fixed delay on top is a deliberate safety margin, not a last-resort
      // patch - tune settleDelayMs per-implementation if a framework needs longer.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setTimeout(() => {
          const n = observer.count();
          lastTick = { kind: nextEntry.kind, mutations: n };
          if (isSwitch) { regionSwitch.ticks++; regionSwitch.mutations += n; }
          else { sameRegion.ticks++; sameRegion.mutations += n; }
          step++;
          renderUpper();
        }, settleDelayMs);
      }));
    }

    // Initial readout waits until the container has actually been
    // populated, so frameworks with an asynchronous commit (React's
    // concurrent root) are measured only after they've rendered. Polling
    // beats a fixed delay here: commit timing varies by framework, and a
    // background tab pauses requestAnimationFrame, so rAF-based waits can
    // fire after (or before) the commit rather than reliably after it.
    let mountPolls = 0;
    (function awaitMount() {
      const hasContent = container.querySelectorAll("*").length > 0;
      if (hasContent || mountPolls++ >= 100) {
        renderUpper();
        return;
      }
      setTimeout(awaitMount, 50);
    })();
  }

  window.VdomHarness = { init };
})();
