const router = require("express").Router();
const c = require("../controllers/sensorController");

router.get("/", c.getLatest);
router.post("/", c.postReading);
router.get("/history", c.getHistory);

module.exports = router;
