const router = require("express").Router();
const c = require("../controllers/alertController");

router.get("/", c.list);
router.post("/", c.create);
router.patch("/:id", c.decide);
router.delete("/", c.clear);

module.exports = router;
