const router = require("express").Router();
const c = require("../controllers/roverController");

router.get("/status", c.getStatus);
router.get("/location", c.getLocation);
router.post("/location", c.postLocation);
router.get("/history", c.getHistory);
router.get("/stream", c.stream);

module.exports = router;
