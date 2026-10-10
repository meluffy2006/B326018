const router = require("express").Router();
const camera = require("../services/cameraService");

// GET /api/camera  -> { mode, lights }
router.get("/", (req, res) => res.json(camera.getState()));

// POST /api/camera  { mode?, lights? }
router.post("/", (req, res) => {
  const out = camera.setState(req.body);
  if (out.error) return res.status(400).json({ error: out.error });
  res.json(out.state);
});

// GET /api/camera/snapshots
router.get("/snapshots", (req, res) => res.json(camera.listSnapshots()));

// POST /api/camera/snapshots  { title?, image: "data:image/jpeg;base64,..." }
router.post("/snapshots", (req, res) => {
  const out = camera.addSnapshot(req.body);
  if (out.error) return res.status(400).json({ error: out.error });
  res.status(201).json(out.snapshot);
});

module.exports = router;
