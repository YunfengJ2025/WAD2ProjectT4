const express = require("express");
const {
  getUsers,
  register,
  login,
  logout,
  getMe,
  updateMe,
  updateTokenBalance
} = require("../controllers/userController");

const router = express.Router();
const requireUser = require("../middleware/requireUser");
const { uploadPhoto } = require("../middleware/uploadPhoto");
const requireAdmin = (req, res, next) => {
  if (req.user.userRole !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};
router.get("/", requireUser, requireAdmin, getUsers);
router.get("/me", requireUser, getMe);
router.patch("/me", requireUser, uploadPhoto, updateMe);
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.patch("/token-balance/:transactionId", requireUser, requireAdmin, updateTokenBalance);
module.exports = router;
