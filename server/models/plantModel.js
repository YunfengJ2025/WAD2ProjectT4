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
        notes: {
            type: String,
            trim: true,
            maxlength: [200, "Watering notes cannot exceed 200 characters"],
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
        sunlight: {
            type: String,
            required: [true, "Sunlight needs are required"],
            enum: {
                values: ["full", "partial", "shade"],
                message: "Sunlight must be full, partial or shade",
            },
        },
        plantLocation: {
            type: String,
            required: [true, "Plant placement is required"],
            enum: {
                values: ["balcony", "corridor", "indoor"],
                message: "Plant placement must be balcony, corridor or indoor",
            },
        },
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

plantSchema.index({ ownerId: 1, plantLocation: 1 });

plantSchema.pre("save", async function () {
    if (this.isNew && this.plantId == null) {
        this.plantId = await getNextSequence("plantId");
    }
});

const Plant = mongoose.model("Plant", plantSchema, "Plant");

const httpError = (status, message) => {
    const err = new Error(message);
    err.status = status;
    return err;
};

function pickPlantFields(body = {}) {
    const data = {};
    for (const field of ["plantName", "sunlight", "plantLocation"]) {
        if (field in body) data[field] = body[field];
    }
    if ("frequencyDays" in body || "notes" in body) {
        data.wateringInfo = {
            frequencyDays: body.frequencyDays,
            notes: body.notes ?? "",
        };
    }
    if ("lastWateredAt" in body) data.lastWateredAt = body.lastWateredAt || null;
    return data;
}

async function getPlantsByOwner(ownerId) {
    return Plant.find({ ownerId }).sort({ createdAt: -1 });
}

async function getPlantByOwner(plantId, ownerId) {
    const id = Number(plantId);
    const plant = Number.isSafeInteger(id)
        ? await Plant.findOne({ plantId: id, ownerId })
        : null;
    if (!plant) throw httpError(404, "Plant not found");
    return plant;
}

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

async function createPlantForOwner(data, ownerId, file) {
    const plant = new Plant({ ...pickPlantFields(data), ownerId });
    await validateUploadAndSave(plant, file);
    return plant;
}

async function updatePlantForOwner(plantId, ownerId, data, file) {
    const plant = await getPlantByOwner(plantId, ownerId);
    plant.set(pickPlantFields(data));
    await validateUploadAndSave(plant, file);
    return plant;
}

async function markPlantWatered(plantId, ownerId) {
    const plant = await getPlantByOwner(plantId, ownerId);
    plant.lastWateredAt = new Date();
    await plant.save();
    return plant;
}

async function deletePlantForOwner(plantId, ownerId) {
    const plant = await getPlantByOwner(plantId, ownerId);
    await plant.deleteOne();
    await deleteImage(plant.photoPublicId);
}

module.exports = {
    Plant,
    getPlantsByOwner,
    getPlantByOwner,
    createPlantForOwner,
    updatePlantForOwner,
    markPlantWatered,
    deletePlantForOwner,
};
