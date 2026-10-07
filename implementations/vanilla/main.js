// implementations/vanilla/main.js
function render(state) {
  const tabs = ["Europe", "Africa", "Asia"].map(r =>
    `<div class="vdom-tab ${r === state.region ? "active" : ""}">${r}</div>`).join("");
  const rows = state.flights.map(f =>
    `<tr><td>${f.flightNum}</td><td>${f.status}</td><td>${f.lastPing}</td></tr>`).join("");
  return `<div class="vdom-tabs-label">Region</div>
  <div class="vdom-tabs">${tabs}</div>
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
