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
      flights = initialFlights(rng, rows);
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
