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

const router = express.Router();
router.use(requireUser);

router.get("/", getMyPlants);
router.post("/", uploadPhoto, createPlant);
router.get("/:plantId", getPlant);
router.patch("/:plantId", uploadPhoto, updatePlant);
router.patch("/:plantId/water", markWatered);
router.delete("/:plantId", deletePlant);

module.exports = router;
