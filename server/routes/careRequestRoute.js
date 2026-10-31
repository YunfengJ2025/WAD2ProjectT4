const express = require("express");
const requireUser = require("../middleware/requireUser");
const controller = require("../controllers/careRequestController");
const router = express.Router();
router.use(requireUser);
router.get("/", controller.mine);
router.post("/", controller.create);
router.post("/:requestId/cancel", controller.cancel);
module.exports = router;
