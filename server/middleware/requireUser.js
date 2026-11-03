const { User } = require("../models/userModel");
const { verifyAccessToken } = require("../config/jwt");

// requireUser: middleware that runs BEFORE any route that needs a logged-in user.
// 1. read the token from the "Authorization: Bearer <token>" header
// 2. check the token is real and not expired (verifyAccessToken)
// 3. load that user from MongoDB and put it on req.user / req.userId
// 4. next() = carry on to the route. Any problem -> 401 and the route never runs.
// (Vue route guards only hide pages in the browser; this is the real security check.)
module.exports = async (req, res, next) => {
  try {
    // The header looks like "Bearer <token>"
    const [type, token] = (req.get("Authorization") || "").split(" ");
    if (type !== "Bearer" || !token) {
      return res.status(401).json({ message: "Please log in first" });
    }

    // The token's subject (sub) is the userId, e.g. "3"
    const payload = verifyAccessToken(token);
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId < 1) {
      return res.status(401).json({ message: "Invalid access token" });
    }
    const user = await User.findOne({ userId });

    if (!user) {
      return res.status(401).json({ message: "Please log in first" });
    }

    req.user = user;
    req.userId = user.userId;
    next();
  } catch (err) {
    // verifyAccessToken throws these when the token is fake, changed or expired
    if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(err.name)) {
      return res.status(401).json({ message: "Invalid or expired access token" });
    }
    console.log("Auth error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
