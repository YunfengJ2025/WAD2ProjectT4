const express = require("express");
const {
  getUsers,
  register,
  login,
  logout,
  getMe,
  updateTokenBalance
} = require("../controllers/userController");

const router = express.Router();
const requireUser = require("../middleware/requireUser");
const requireAdmin = (req, res, next) => {
  if (req.user.userRole !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};
router.get("/", requireUser, requireAdmin, getUsers);
router.get("/me", requireUser, getMe);
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.patch("/token-balance/:transactionId", requireUser, requireAdmin, updateTokenBalance);
module.exports = router;
