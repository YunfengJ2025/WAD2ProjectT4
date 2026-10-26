const { User } = require("../models/userModel");
const { verifyAccessToken } = require("../config/jwt");

module.exports = async (req, res, next) => {
  try {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get("Authorization") || "");
    if (!match) {
      return res.status(401).json({ message: "Please log in first" });
    }

    const payload = verifyAccessToken(match[1]);
    if (!/^[1-9]\d*$/.test(payload.sub) || !Number.isSafeInteger(Number(payload.sub))) {
      return res.status(401).json({ message: "Invalid access token" });
    }
    const user = await User.findOne({ userId: Number(payload.sub) });

    if (!user) {
      return res.status(401).json({ message: "Please log in first" });
    }

    req.user = user;
    req.userId = user.userId;
    next();
  } catch (err) {
    if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(err.name)) {
      return res.status(401).json({ message: "Invalid or expired access token" });
    }
    console.log("Auth error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
