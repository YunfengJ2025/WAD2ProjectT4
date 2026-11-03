// tokenTransactionRoutes.js
const router = require("express").Router();
const controller = require("../controllers/tokenController");
const requireUser = require("../middleware/requireUser");
// System gifts intentionally bypass authentication.
// Care claims still need JWT authentication to identify the sitter who completed the visit.
router.post(
  "/",
  (req, res, next) =>
    req.body?.type === "SYSTEM_GIFT" ? next() : requireUser(req, res, next),
  controller.createTokenTran,
);
router.get("/", controller.getAllTokenTran);
router.get("/user/:userId", controller.getTranHistoryByUser);
router.get("/type/:type", controller.getTranByType);

module.exports = router;
