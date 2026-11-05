const express = require("express");
const router = express.Router();
const boardController = require("../controllers/boardController");
const requireUser = require("../middleware/requireUser");

// Leaderboard routes
router.get("/leaderboard", boardController.getLeaderboard);
router.get("/leaderboard/status/:userId", boardController.getOptOutStatus);
router.patch("/leaderboard/opt-out/:userId", requireUser, boardController.toggleOptOut);

// Dashboard routes
router.get("/dashboard/stats/:userId", boardController.getUserStats);
router.get("/dashboard/charts/:userId", boardController.getUserCharts);

module.exports = router;
