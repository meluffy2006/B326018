// In-memory camera state (view mode, LED lights) and saved snapshots.
const MODES = ["normal", "thermal", "night"];
const MAX_SNAPSHOTS = 20;

const state = { mode: "normal", lights: true };
const snapshots = [];
let nextId = 1;

function getState() {
  return { ...state };
}

function setState(body = {}) {
  if (body.mode !== undefined) {
    if (!MODES.includes(body.mode)) return { error: `mode must be one of: ${MODES.join(", ")}` };
    state.mode = body.mode;
  }
  if (body.lights !== undefined) {
    if (typeof body.lights !== "boolean") return { error: "lights must be true or false" };
    state.lights = body.lights;
  }
  return { state: getState() };
}

// image: a data URL (e.g. "data:image/jpeg;base64,...")
function addSnapshot({ title, image } = {}) {
  if (typeof image !== "string" || !image.startsWith("data:image/")) {
    return { error: "image must be an image data URL" };
  }
  const snap = {
    id: nextId++,
    title: String(title || "Snapshot").slice(0, 100),
    image,
    mode: state.mode,
    time: Date.now()
  };
  snapshots.unshift(snap);
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.pop();
  return { snapshot: snap };
}

function listSnapshots() {
  return snapshots;
}

module.exports = { MODES, getState, setState, addSnapshot, listSnapshots };
