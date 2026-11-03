const express = require("express");
const requireUser = require("../middleware/requireUser");
const { uploadPhoto } = require("../middleware/uploadPhoto");
const {
  getMyPlants,
  getPlant,
  createPlant,
  updatePlant,
  markWatered,
  deletePlant,
} = require("../controllers/plantController");

// All plant routes are mounted at /plants in server.js
const router = express.Router();
// Every route below needs a logged-in user (sets req.userId)
router.use(requireUser);

// uploadPhoto (multer) runs first on create/update to read the form + optional photo
router.get("/", getMyPlants);
router.post("/", uploadPhoto, createPlant);
router.get("/:plantId", getPlant);
router.patch("/:plantId", uploadPhoto, updatePlant);
router.patch("/:plantId/water", markWatered);
router.delete("/:plantId", deletePlant);

module.exports = router;
