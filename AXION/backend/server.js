const express = require("express");
const path = require("path");

const ROOT = path.join(__dirname, "..");            // AXION/ (one level above backend/)
const FRONTEND = path.join(ROOT, "frontend");

// Load .env (Node 20.12+/21.7+). Variables already set in the shell win.
try { process.loadEnvFile(path.join(ROOT, ".env")); } catch (e) { /* no .env or older Node: use defaults */ }

const PORT = Number(process.env.PORT) || 3000;
const DEMO = ["1", "true", "yes"].includes(String(process.env.DEMO).toLowerCase()) || process.argv.includes("--demo");

const sensorRoutes = require("./routes/sensorRoutes");
const roverRoutes = require("./routes/roverRoutes");
const alertRoutes = require("./routes/alertRoutes");
const cameraRoutes = require("./routes/cameraRoutes");
const roverController = require("./controllers/roverController");
const pool = require("./db");

const app = express();
app.use(express.json({ limit: "2mb" }));   // room for camera snapshots sent as data URLs

// Health check: server + database
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ server: "ok", database: "ok" });
  } catch (e) {
    res.status(503).json({ server: "ok", database: "down", error: e.message });
  }
});

// API
app.use("/api/sensors", sensorRoutes);
app.use("/api/rover", roverRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/camera", cameraRoutes);

// Old URLs, kept so the Swift app / rover keeps working without changes
app.post("/api/location", roverController.postLocation);
app.get("/api/location", roverController.getLocation);
app.get("/api/history", roverController.getHistory);
app.get("/api/stream", roverController.stream);

// Static files
app.use("/frontend", express.static(FRONTEND));
app.use("/Maps", express.static(path.join(FRONTEND, "Maps")));   // short URL for the live map
app.use(express.static(path.join(ROOT, "public")));              // favicon.ico etc.
app.get("/", (req, res) => res.redirect("/frontend/index.html"));

// Unknown API routes and bad JSON -> JSON errors
app.use("/api", (req, res) => res.status(404).json({ error: "not found" }));
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") return res.status(400).json({ error: "invalid JSON body" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "request body too large" });
  console.error(err);
  res.status(500).json({ error: "server error" });
});

// Demo mode: npm run demo (or DEMO=1 in .env) -> fake rover driving a loop
if (DEMO) {
  let a = 0;
  setInterval(() => {
    a += 0.05;
    const lat = 13.1346 + Math.sin(a) * 0.0008, lng = 77.5680 + Math.cos(a) * 0.0012;
    fetch(`http://localhost:${PORT}/api/rover/location`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, speed: 0.6, heading: (a * 57.3 + 90) % 360 })
    }).catch(() => {});
  }, 1000);
}

// Check the database once at startup. Not fatal: the dashboard still works without it.
pool.query("SELECT current_database() AS db")
  .then(r => console.log(`Database       : connected to ${r.rows[0].db}`))
  .catch(e => console.warn(`Database       : NOT connected (${e.message}). Start it with: npm run db:up`));

app.listen(PORT, () => {
  console.log(`Command center : http://localhost:${PORT}/frontend/index.html`);
  console.log(`Live rover map : http://localhost:${PORT}/Maps/maps.html`);
  if (DEMO) console.log("Demo mode on: simulated rover posts a location every second");
});
