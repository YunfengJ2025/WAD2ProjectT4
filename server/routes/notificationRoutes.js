const router = require("express").Router();
const requireUser = require("../middleware/requireUser");
const controller = require("../controllers/notificationController");

// Protect notification reads and updates with the authenticated user.
router.use(requireUser);
router.get("/", controller.listMine);
router.patch("/:notificationId/read", controller.markRead);

module.exports = router;
