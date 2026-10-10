// In-memory alert store. Alerts can be raised by the rover and reviewed by an officer.
const SEVERITIES = ["low", "med", "high"];
const DECISIONS = ["threat confirmed", "false alarm", "escalated"];
const MAX_ALERTS = 100;

let alerts = [];
let nextId = 100;

// POST /api/alerts   { type, sev?, zone? }
exports.create = (req, res) => {
  const { type, sev = "med", zone = "Unknown zone", temp = null } = req.body || {};
  if (typeof type !== "string" || !type.trim()) return res.status(400).json({ error: "type is required" });
  if (!SEVERITIES.includes(sev)) return res.status(400).json({ error: `sev must be one of: ${SEVERITIES.join(", ")}` });
  const alert = {
    id: ++nextId,
    type: type.trim().slice(0, 100),
    sev,
    zone: String(zone).slice(0, 100),
    temp: temp !== null && temp !== "" && Number.isFinite(Number(temp)) ? Number(temp) : null,
    status: "open",
    time: Date.now()
  };
  alerts.unshift(alert);
  alerts = alerts.slice(0, MAX_ALERTS);
  res.status(201).json(alert);
};

// GET /api/alerts?status=open
exports.list = (req, res) => {
  const { status } = req.query;
  res.json(status ? alerts.filter(a => a.status === status) : alerts);
};

// PATCH /api/alerts/:id   { status: "threat confirmed" | "false alarm" | "escalated" }
exports.decide = (req, res) => {
  const alert = alerts.find(a => a.id === Number(req.params.id));
  if (!alert) return res.status(404).json({ error: "alert not found" });
  const status = (req.body || {}).status;
  if (!DECISIONS.includes(status)) return res.status(400).json({ error: `status must be one of: ${DECISIONS.join(", ")}` });
  alert.status = status;
  alert.decidedAt = Date.now();
  res.json(alert);
};

// DELETE /api/alerts
exports.clear = (req, res) => { alerts = []; res.json({ ok: true }); };
