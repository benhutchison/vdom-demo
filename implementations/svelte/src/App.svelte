<script>
  let { state } = $props(); // do NOT destructure this into { region, flights } - that
                              // flattens the reactive proxy and breaks per-field tracking
</script>

<div class="vdom-tabs-label">Region</div>
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
