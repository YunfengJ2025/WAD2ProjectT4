// tokenTransactionRoutes.js
const router = require("express").Router();
const controller = require("../controllers/tokenController");
const requireUser = require("../middleware/requireUser")
// JWT middleware supplies req.userId so the controller can verify the reward claimant.
router.post(
  "/",
  requireUser,
  controller.createTokenTran,
);
router.get("/", controller.getAllTokenTran);
router.get("/user/:userId", controller.getTranHistoryByUser);
router.get("/type/:type", controller.getTranByType);

module.exports = router;
