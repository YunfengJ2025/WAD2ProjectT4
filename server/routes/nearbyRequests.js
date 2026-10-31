const express = require("express");
const requireUser = require("../middleware/requireUser");
const { findNearby } = require("../controllers/mapController");

const router = express.Router();

// GET /find-nearby  (the browser calls it as /api/find-nearby)
router.get("/", requireUser, findNearby);

module.exports = router;