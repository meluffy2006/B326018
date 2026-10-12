const sensorService = require("../services/sensorService");

// POST /api/sensors   (rover hardware sends readings)
exports.postReading = (req, res) => {
  const out = sensorService.update(req.body);
  if (out.error) return res.status(400).json({ error: out.error });
  res.json({ ok: true, reading: out.reading });
};

// GET /api/sensors   -> { live, reading }
exports.getLatest = (req, res) => res.json(sensorService.getLatest());

// GET /api/sensors/history
exports.getHistory = (req, res) => res.json(sensorService.getHistory());
