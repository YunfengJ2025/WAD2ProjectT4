const express = require("express");
const router = express.Router();
const boardController = require("../controllers/boardController");

// Leaderboard routes
router.get("/leaderboard", boardController.getLeaderboard);
router.patch("/leaderboard/opt-out/:userId", boardController.toggleOptOut);

// Dashboard routes
router.get("/dashboard/stats/:userId", boardController.getUserStats);
router.get("/dashboard/charts/:userId", boardController.getUserCharts);

module.exports = router;
