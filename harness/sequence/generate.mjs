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
