const {
  registerUser,
  loginUser,
  toAuthJSON,
  getAllUsers,
  applyTransactionToBalances,
} = require("../models/userModel");
const { createTransaction, TokenTransaction } = require("../models/tokenModel");
const STARTER_TOKENS = 50;
const { createAccessToken } = require("../config/jwt");

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
exports.getMe = (req, res) => res.json({ user: toAuthJSON(req.user) });
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
