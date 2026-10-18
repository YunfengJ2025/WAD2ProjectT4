const mongoose = require("mongoose");
const { getNextSequence } = require("./counterModel");
const { uploadImage, deleteImage } = require("../config/cloudinary");

const wateringInfoSchema = new mongoose.Schema(
    {
        frequencyDays: {
            type: Number,
            required: [true, "Watering frequency is required"],
            min: [1, "Watering frequency must be at least 1 day"],
            max: [30, "Watering frequency cannot be more than 30 days"],
            validate: {
                validator: Number.isSafeInteger,
                message: "Watering frequency must be a whole number of days",
            },
        },
        // How much water to give each time, in millilitres (e.g. 250).
        amountMl: {
            type: Number,
            required: [true, "Amount of water is required"],
            min: [10, "Amount must be at least 10 ml"],
            max: [5000, "Amount cannot be more than 5000 ml"],
            validate: {
                validator: Number.isSafeInteger,
                message: "Amount must be a whole number of ml",
            },
        },
        notes: {
            type: String,
            trim: true,
            maxlength: [500, "Care notes cannot exceed 500 characters"],
            default: "",
        },
    },
    { _id: false },
);

const plantSchema = new mongoose.Schema(
    {
        plantId: { type: Number, unique: true, sparse: true, immutable: true },
        ownerId: {
            type: Number,
            required: [true, "A plant must have an owner"],
            min: [1, "Owner ID must be positive"],
            // once a plant is created, its owner can't change.
            immutable: true,
            //If the edit form ever sends a different ownerId, Mongoose ignores it, 
            // so nobody can move a plant to another account.
            validate: {
                validator: Number.isSafeInteger,
                message: "Owner ID must be a whole number",
            },
        },
        plantName: {
            type: String,
            required: [true, "Plant name is required"],
            trim: true,
            maxlength: [100, "Plant name cannot exceed 100 characters"],
        },
        // Cloudinary link to the photo, e.g. https://res.cloudinary.com/...
        photoUrl: { type: String, trim: true, default: "" },
        // Cloudinary's id for the photo, needed to delete or replace it.
        photoPublicId: { type: String, default: "" },
        wateringInfo: {
            type: wateringInfoSchema,
            required: [true, "Watering information is required"],
        },
        // Where in the corridor the plant is, e.g. "Floor pot beside the shoe rack".
        plantLocation: {
            type: String,
            required: [true, "Please describe where to find the plant"],
            trim: true,
            maxlength: [100, "Location cannot exceed 100 characters"],
        },
        // true = the pot is in the open and gets rained on; false = sheltered.
        // Set by the owner in the form; used by the weather-based checklist.
        rainExposed: { type: Boolean, default: false },
        weatherAdjustmentEnabled: { type: Boolean, default: false },
        lastWateredAt: {
            type: Date,
            default: null,
            validate: {
                // Allow a minute of leeway for clock differences.
                validator: (date) => date == null || date.getTime() <= Date.now() + 60_000,
                message: "Last watered date cannot be in the future",
            },
        },
    },
    { timestamps: true },
);

// Index so "find all plants for this owner" is fast (most queries filter by ownerId).
plantSchema.index({ ownerId: 1, plantLocation: 1 });

// Runs automatically before every save.
// For a brand-new plant, give it the next number from the counter collection
// (1, 2, 3...), so URLs can use /plants/5 instead of Mongo's long _id.
plantSchema.pre("save", async function () {
    if (this.isNew && this.plantId == null) {
        this.plantId = await getNextSequence("plantId");
    }
});

// The model we use to read/write plants. The third argument is the collection name.
const Plant = mongoose.model("Plant", plantSchema, "Plant");

// Makes an Error with an HTTP status attached (e.g. 404).
// The controller's handleError sends err.status back to the browser.
const httpError = (status, message) => {
    const err = new Error(message);
    err.status = status;
    return err;
};

// Copies only the fields a user is allowed to set from the request body.
// Anything else (ownerId, plantId, photoUrl...) is ignored, so users can't
// change them by sending extra form fields.
// The form sends flat names (frequencyDays, amountMl, notes), so they are
// grouped into the wateringInfo sub-document here.
function pickPlantFields(body = {}) {
    const data = {};
    for (const field of ["plantName", "plantLocation", "rainExposed"]) {
        if (field in body) data[field] = body[field];
    }
    if ("frequencyDays" in body || "amountMl" in body || "notes" in body) {
        data.wateringInfo = {
            frequencyDays: body.frequencyDays,
            amountMl: body.amountMl,
            notes: body.notes ?? "",
        };
    }
    // An empty date from the form means "never watered", stored as null.
    if ("lastWateredAt" in body) data.lastWateredAt = body.lastWateredAt || null;
    return data;
}

// All plants belonging to one user, newest first.
async function getPlantsByOwner(ownerId) {
    return Plant.find({ ownerId }).sort({ createdAt: -1 });
}

// One plant, but only if it belongs to this user.
async function getPlantByOwner(plantId, ownerId) {
    const id = Number(plantId);
    const plant = Number.isSafeInteger(id)
        ? await Plant.findOne({ plantId: id, ownerId })
        : null;
    if (!plant) throw httpError(404, "Plant not found");
    return plant;
}

// Saves a plant, uploading a new photo to Cloudinary if one was given.
// Order matters:
// 1. Validate first, so we don't upload a photo for a plant that will fail.
// 2. Upload the new photo and save the plant with its new URL.
// 3. If saving fails, delete the photo we just uploaded (no orphan images).
// 4. Only after a successful save, delete the old photo (so a failed
//    update never leaves the plant without a picture).
async function validateUploadAndSave(plant, file) {
    await plant.validate();
    if (!file) return plant.save();

    const oldPublicId = plant.photoPublicId;
    const { url, publicId } = await uploadImage(file.buffer);
    plant.photoUrl = url;
    plant.photoPublicId = publicId;
    try {
        await plant.save();
    } catch (err) {
        await deleteImage(publicId);
        throw err;
    }
    await deleteImage(oldPublicId);
    return plant;
}

// Creates a new plant for the logged-in user.
// ownerId comes from the login session (see middleware/requireUser.js),
// not the form, so it can't be faked.
async function createPlantForOwner(data, ownerId, file) {
    const plant = new Plant({ ...pickPlantFields(data), ownerId });
    await validateUploadAndSave(plant, file);
    return plant;
}

// Edits a plant: find it (must be yours), apply the new values, then save.
// plant.set() only changes the fields that were sent.
async function updatePlantForOwner(plantId, ownerId, data, file) {
    const plant = await getPlantByOwner(plantId, ownerId);
    plant.set(pickPlantFields(data));
    await validateUploadAndSave(plant, file);
    return plant;
}

// Sets "last watered" to right now. 
// so a finished care visit can update the plant's watering status.
async function markPlantWatered(plantId, ownerId) {
    const plant = await getPlantByOwner(plantId, ownerId);
    plant.lastWateredAt = new Date();
    await plant.save();
    return plant;
}

// Deletes a plant (must be yours), then removes its photo from Cloudinary.
// deleteImage does nothing if the plant had no photo.
async function deletePlantForOwner(plantId, ownerId) {
    const plant = await getPlantByOwner(plantId, ownerId);
    await plant.deleteOne();
    await deleteImage(plant.photoPublicId);
}

// Used by controllers/plantController.js
module.exports = {
    Plant,
    getPlantsByOwner,
    getPlantByOwner,
    createPlantForOwner,
    updatePlantForOwner,
    markPlantWatered,
    deletePlantForOwner,
};
