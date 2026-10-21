const express = require("express");
const { getUsers, register, login, logout } = require("../controllers/userController");

const router = express.Router();
router.get("/", getUsers);
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

module.exports = router;
