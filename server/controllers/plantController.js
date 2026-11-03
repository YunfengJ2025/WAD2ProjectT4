const {
  getPlantsByOwner,
  getPlantByOwner,
  createPlantForOwner,
  updatePlantForOwner,
  markPlantWatered,
  deletePlantForOwner,
} = require("../models/plantModel");

// Schema paths -> form field names, so errors show next to the right input.
const FIELD_NAMES = {
  "wateringInfo.frequencyDays": "frequencyDays",
  "wateringInfo.amountMl": "amountMl",
  "wateringInfo.notes": "notes",
  wateringInfo: "frequencyDays",
};

// One place that turns any error into the right HTTP response:
// 1. our own errors with a status (e.g. 404 "Plant not found" from the model)
// 2. Mongoose ValidationError -> 400 with a message per form field, e.g.
//    { message: "...", errors: { plantName: "Plant name is required" } }
//    so the form can show each message under the right input
// 3. anything else -> 500 "Server error" (details only in the server console)
const handleError = (err, res) => {
  if (err.status) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err.name === "ValidationError") {
    const errors = {};
    for (const [key, detail] of Object.entries(err.errors)) {
      const field = FIELD_NAMES[key] || key;
      // Keep the first message for each field
      if (!errors[field]) {
        errors[field] =
          detail.name === "CastError" ? "Please enter a valid value" : detail.message;
      }
    }
    return res
      .status(400)
      .json({ message: "Please fix the highlighted fields", errors });
  }
  console.log(err);
  res.status(500).json({ message: "Server error" });
};

// Each handler below: read the request, call a model function, send JSON back.
// req.userId is set by middleware/requireUser.js (the logged-in user),
// so users can only ever see or change their own plants.

// GET /plants
exports.getMyPlants = async (req, res) => {
  try {
    const plants = await getPlantsByOwner(req.userId);
    res.json({ count: plants.length, plants });
  } catch (err) {
    handleError(err, res);
  }
};

// GET /plants/:plantId
exports.getPlant = async (req, res) => {
  try {
    const plant = await getPlantByOwner(req.params.plantId, req.userId);
    res.json({ plant });
  } catch (err) {
    handleError(err, res);
  }
};

// POST /plants (multipart/form-data, optional "photo" file)
exports.createPlant = async (req, res) => {
  try {
    const plant = await createPlantForOwner(req.body, req.userId, req.file);
    res.status(201).json({ plant });
  } catch (err) {
    handleError(err, res);
  }
};

// PATCH /plants/:plantId (multipart/form-data, optional "photo" file)
exports.updatePlant = async (req, res) => {
  try {
    const plant = await updatePlantForOwner(
      req.params.plantId,
      req.userId,
      req.body,
      req.file,
    );
    res.json({ plant });
  } catch (err) {
    handleError(err, res);
  }
};

// PATCH /plants/:plantId/water
exports.markWatered = async (req, res) => {
  try {
    const plant = await markPlantWatered(req.params.plantId, req.userId);
    res.json({ plant });
  } catch (err) {
    handleError(err, res);
  }
};

// DELETE /plants/:plantId
exports.deletePlant = async (req, res) => {
  try {
    await deletePlantForOwner(req.params.plantId, req.userId);
    res.status(204).end();
  } catch (err) {
    handleError(err, res);
  }
};
