const {
  registerUser,
  loginUser,
  toAuthJSON,
  getAllUsers,
} = require("../models/userModel");
const handleError = (err, res) => {
  console.log(err);
  if (err.status) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({ message: `That ${field} is already taken` });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }
  res.status(500).json({ message: "Server error" });
};

// GET /user
exports.getUsers = async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json({ count: users.length, users });
  } catch (err) {
    handleError(err, res);
  }
};
// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const body = req.body || {};
    console.log(req.body);
    // Check required fields before touching the model
    const requiredFields = ["userName", "email", "password"];
    const missing = requiredFields.filter(
      (field) => typeof body[field] !== "string" || body[field].trim() === "",
    );

    if (missing.length > 0) {
      return res
        .status(400)
        .json({ message: `Missing required field(s): ${missing.join(", ")}` });
    }

    const user = await registerUser(body);
    req.session.userId = user.userId;
    res.status(201).json({ user: toAuthJSON(user) });
  } catch (err) {
    handleError(err, res);
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const body = req.body || {};

    const requiredFields = ["email", "password"];
    const missing = requiredFields.filter(
      (field) => typeof body[field] !== "string" || body[field].trim() === "",
    );

    if (missing.length > 0) {
      return res
        .status(400)
        .json({ message: `Missing required field(s): ${missing.join(", ")}` });
    }

    const { email, password } = body; // add this line
    const user = await loginUser(email, password);
    // Remembered for later requests; see middleware/requireUser.js
    req.session.userId = user.userId;
    res.json({ user: toAuthJSON(user) });
  } catch (err) {
    handleError(err, res);
  }
};
