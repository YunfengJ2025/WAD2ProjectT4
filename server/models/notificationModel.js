const mongoose = require("mongoose");

// Store per-user policy notices so the navbar can show and mark them read.
const notificationSchema = new mongoose.Schema({
  userId: { type: Number, required: true, index: true },
  type: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  visitId: { type: Number, default: null },
  requestId: { type: Number, default: null },
  readAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema, "Notification");
