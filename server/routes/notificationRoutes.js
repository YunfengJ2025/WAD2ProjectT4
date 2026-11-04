const router = require("express").Router();
const requireUser = require("../middleware/requireUser");
const controller = require("../controllers/notificationController");

// Protect notification reads and updates with the authenticated user.
router.use(requireUser);
router.get("/", controller.listMine);
router.patch("/:notificationId/read", controller.markRead);
// (Carolyn) mark all read, delete one, clear all (only the signed-in user's own notices)
router.patch("/read-all", controller.markAllRead);
router.delete("/:notificationId", controller.removeOne);
router.delete("/", controller.clearAll);

module.exports = router;
