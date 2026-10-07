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

