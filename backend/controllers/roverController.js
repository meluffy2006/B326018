const sensorService = require("../services/sensorService");

const LIVE_MS = 10000;
let last = null;
const history = [];
const clients = new Set();

// POST /api/rover/location   (rover / Swift app sends its position)
exports.postLocation = (req, res) => {
  const body = req.body || {};
  const lat = Number(body.lat), lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: "lat and lng must be valid numbers" });
  }
  last = {
    lat, lng,
    speed: Number(body.speed) || 0,
    heading: Number(body.heading) || 0,
    time: Date.now()
  };
  history.push(last);
  if (history.length > 500) history.shift();
  clients.forEach(c => { try { c.write(`data: ${JSON.stringify(last)}\n\n`); } catch (e) { clients.delete(c); } });
  res.json({ ok: true });
};

// GET /api/rover/location
exports.getLocation = (req, res) => res.json(last);

// GET /api/rover/history
exports.getHistory = (req, res) => res.json(history);

// GET /api/rover/status
exports.getStatus = (req, res) => {
  const { reading } = sensorService.getLatest();
  res.json({
    online: !!last && Date.now() - last.time < LIVE_MS,
    location: last,
    battery: reading && reading.battery !== undefined ? reading.battery : null
  });
};

// GET /api/rover/stream   live position to the browser (Server-Sent Events)
exports.stream = (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  clients.add(res);
  const ping = setInterval(() => res.write(": ping\n\n"), 25000);   // keep the stream alive through proxies
  const done = () => { clearInterval(ping); clients.delete(res); };
  req.on("close", done);   // browser left the page
  res.on("close", done);
  res.on("error", done);
};
