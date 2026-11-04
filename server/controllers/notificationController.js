const Notification = require("../models/notificationModel");
const CareVisit = require("../models/careVisitModel");

// Return only the signed-in user's most recent notices.
exports.listMine = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    // Resolve request ids for older notices that stored only a visit id.
    const visitIds = notifications.map((item) => item.visitId).filter(Number.isSafeInteger);
    const visits = await CareVisit.find({ visitId: { $in: visitIds } })
      .select("visitId requestId")
      .lean();
    const requestByVisitId = new Map(visits.map((visit) => [visit.visitId, visit.requestId]));
    res.json({
      notifications: notifications.map((item) => ({
        ...item,
        // Remove the old make-up offer from notifications created before this policy change.
        message: item.type === "visit_expired"
          ? item.message.replace(/\s*You can request a make-up visit\.?$/i, "")
          : item.message,
        requestId: item.requestId || requestByVisitId.get(item.visitId) || null,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not load notifications" });
  }
};

// A user can mark only their own notification as read.
exports.markRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, userId: req.userId },
      { $set: { readAt: new Date() } },
      { new: true },
    ).lean();
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json({ notification });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Invalid notification" });
  }
};

// (Carolyn) PATCH /notifications/read-all: mark every unread notice of this user as read
exports.markAllRead = async (req, res) => {
  try {
    const readAt = new Date();
    const result = await Notification.updateMany({ userId: req.userId, readAt: null }, { $set: { readAt } });
    res.json({ updated: result.modifiedCount, readAt });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not mark notifications as read" });
  }
};

// (Carolyn) DELETE /notifications/:notificationId: a user can delete only their own notice
exports.removeOne = async (req, res) => {
  try {
    const result = await Notification.deleteOne({ _id: req.params.notificationId, userId: req.userId });
    if (!result.deletedCount) return res.status(404).json({ message: "Notification not found" });
    res.json({ deleted: 1 });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Invalid notification" });
  }
};

// (Carolyn) DELETE /notifications: clear all of this user's notices
exports.clearAll = async (req, res) => {
  try {
    const result = await Notification.deleteMany({ userId: req.userId });
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not clear notifications" });
  }
};
