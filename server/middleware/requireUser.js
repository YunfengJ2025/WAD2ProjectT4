const { User } = require("../models/userModel");

module.exports = async (req, res, next) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Please log in first" });
    }

    const user = await User.findOne({ userId: req.session.userId });

    if (!user) {
      return req.session.destroy(() => {
        res.status(401).json({ message: "Please log in first" });
      });
    }

    req.user = user;
    req.userId = user.userId;
    next();
  } catch (err) {
    console.log("Auth error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
