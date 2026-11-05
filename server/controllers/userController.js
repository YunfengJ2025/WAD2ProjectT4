const {
  registerUser,
  loginUser,
  toAuthJSON,
  updateProfile,
  getAllUsers,
  applyTransactionToBalances,
  getPublicProfile,
  deleteAccount,
} = require("../models/userModel");
const { createTransaction, TokenTransaction } = require("../models/tokenModel");
const { syncUserBadges } = require("./boardController");
const STARTER_TOKENS = 50;
const { createAccessToken } = require("../config/jwt");
const { coordinatesOf } = require("../utils/userCoordinates");



function authResponse(user) {
  return { user: toAuthJSON(user), accessToken: createAccessToken(user), tokenType: "Bearer", expiresIn: 3600 };
}

async function giveStarterTokens(userId) {
  const txn = await createTransaction({
    type: "SYSTEM_GIFT",
    reason: "Beginner starter tokens",
    receiverId: userId,
    amount: STARTER_TOKENS,
  });
  try {
    return await applyTransactionToBalances(txn.transactionId);
  } catch (err) {
    // balance update failed: don't keep a transaction without matching balances
    await TokenTransaction.deleteOne({ _id: txn._id });
    throw err;
  }
}
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
    const errors = Object.fromEntries(Object.entries(err.errors).map(([field, detail]) => [field, detail.message]));
    return res.status(400).json({ message: "Please fix the highlighted fields", errors });
  }
  res.status(500).json({ message: "Server error" });
};

// Get /:userId/profile
exports.getPublicProfile = async (req, res) => {
  if (
    !/^[1-9]\d*$/.test(req.params.userId) ||
    !Number.isSafeInteger(Number(req.params.userId))
  ) {
    return res.status(400).json({ message: "Invalid user ID" });
  }
  try {
    const profile = await getPublicProfile(Number(req.params.userId));
    if (!profile) return res.status(404).json({ message: "Profile not found" });
    res.json(profile);
  } catch (err) {
    handleError(err, res);
  }
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
    // Check required fields before touching the model
    const requiredFields = [
      "userName",
      "email",
      "password",
      "postalCode",
      "block",
      "unitNumber",
    ];
    const missing = requiredFields.filter(
      (field) => typeof body[field] !== "string" || body[field].trim() === "",
    );

    if (missing.length > 0) {
      return res
        .status(400)
        .json({ message: `Missing required field(s): ${missing.join(", ")}` });
    }

    const user = await registerUser(body);

    // Starter pack: a failure here must not undo a successful registration
    try {
      const gift = await giveStarterTokens(user.userId);
      user.tokenBalance = gift.receiverBalance; // so the response shows the new balance
    } catch (giftErr) {
      console.log("Starter token gift failed:", giftErr);
    }

    res.status(201).json(authResponse(user));
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
    res.json(authResponse(user));
  } catch (err) {
    handleError(err, res);
  }
};

exports.logout = (req, res) => {
  // Stateless JWT logout: the client must discard its access token.
  res.status(204).end();
};
exports.getMe = (req, res) => {
  try {
    if (typeof syncUserBadges === "function") {
      // Fire-and-forget in the background without awaiting, so /user/me returns immediately (<50ms)
      syncUserBadges(req.user.userId || req.user._id).catch((err) => {
        console.error("Error auto-syncing badges in background:", err);
      });
    }
  } catch (err) {
    console.error("Error triggering badge sync in getMe:", err);
  }
  res.json({ user: toAuthJSON(req.user) });
};

// GET /user/me/location -> { lat, lng }
// Where the signed-in user lives, for the weather banner. Same lookup as Find Nearby
// (OneMap the first time, then the saved coordinates).
exports.getMyLocation = async (req, res) => {
  try {
    const pos = await coordinatesOf(req.user);
    if (!pos) {
      return res.status(404).json({ message: "We couldn't find your postal code on the map. Check it on your profile." });
    }
    res.json(pos);
  } catch (err) {
    handleError(err, res);
  }
};

// DELETE /user/me  body: { password }
// Deletes your own account (see deleteAccount in userModel for the rules)
exports.deleteMe = async (req, res) => {
  try {
    await deleteAccount(req.userId, (req.body || {}).password);
    res.status(204).end();
  } catch (err) {
    handleError(err, res);
  }
};

// PATCH /user/me
exports.updateMe = async (req, res) => {
  try {
    const user = await updateProfile(req.user, req.body || {}, req.file);
    res.json({ user: toAuthJSON(user) });
  } catch (err) {
    handleError(err, res);
  }
};
exports.updateTokenBalance = async (req, res) => {
  try {
    const result = await applyTransactionToBalances(
      Number(req.params.transactionId),
    );
    res.json(result);
  } catch (err) {
    handleError(err, res);
  }
};
