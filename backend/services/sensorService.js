// In-memory store for sensor readings sent by the rover hardware.
const LIVE_MS = 10000;      // a reading older than this is considered stale
const MAX_HISTORY = 200;

let latest = null;
const history = [];

const FIELDS = ["temperature", "distance", "battery"];

// Validates and stores a reading. Returns { reading } or { error }.
function update(body = {}) {
  const incoming = {};
  for (const f of FIELDS) {
    if (body[f] === undefined || body[f] === null || body[f] === "") continue;
    const n = Number(body[f]);
    if (!Number.isFinite(n)) return { error: `${f} must be a number` };
    incoming[f] = n;
  }
  if (!Object.keys(incoming).length) {
    return { error: "send at least one of: temperature, distance, battery" };
  }
  if (incoming.battery !== undefined && (incoming.battery < 0 || incoming.battery > 100)) {
    return { error: "battery must be between 0 and 100" };
  }
  latest = { ...(latest || {}), ...incoming, time: Date.now() };
  history.push(latest);
  if (history.length > MAX_HISTORY) history.shift();
  return { reading: latest };
}

function getLatest() {
  return { live: !!latest && Date.now() - latest.time < LIVE_MS, reading: latest };
}

function getHistory() {
  return history;
}

module.exports = { update, getLatest, getHistory };
