const express = require("express");
const {
  getUsers,
  register,
  login,
  logout,
  getMe,
  getMyLocation,
  getPublicProfile,
  updateMe,
  deleteMe,
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
router.get("/me/location", requireUser, getMyLocation); // { lat, lng } for the weather banner
router.get("/:userId/profile", getPublicProfile);
router.patch("/me", requireUser, uploadPhoto, updateMe);
router.delete("/me", requireUser, deleteMe); // delete your own account (needs your password)
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);
router.patch("/token-balance/:transactionId", requireUser, requireAdmin, updateTokenBalance);
module.exports = router;
