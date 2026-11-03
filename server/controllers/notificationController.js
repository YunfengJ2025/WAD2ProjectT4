const Notification = require("../models/notificationModel");

// Return only the signed-in user's most recent notices.
exports.listMine = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ notifications });
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
