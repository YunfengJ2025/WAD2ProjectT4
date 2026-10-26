const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { getNextSequence } = require("./counterModel");
const userSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      unique: true,
      sparse: true, // lets multiple documents exist without a userId
    },
    userName: {
      type: String,
      required: [true, "A user must have a username"],
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: [true, "A user must have an email"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email"],
    },
    passwordHash: {
      type: String,
      required: [true, "A user must have a password"],
      select: false,
    },
    postalCode: {
      type: String,
      required: [true, "A user must have a postal code"],
      match: [/^\d{6}$/, "Postal code must be 6 digits"],
    },
    block: {
      type: String,
      required: [true, "A user must have a block"],
      trim: true,
    },
    unitNumber: {
      type: String,
      required: [true, "A user must have a unit number"],
      trim: true,
    },
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    tokenBalance: {
      type: Number,
      default: 0,
      min: [0, "Token balance cannot be negative"],
    },
    accountPublic: {
      type: Boolean,
      default: false,
    },
    userRole: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

const User = mongoose.model("User", userSchema, "User");
const { TokenTransaction } = require("./tokenModel");
const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

// Creates a new user. Only whitelisted fields are accepted, so callers
// can't set userRole, tokenBalance, etc.
// Returns all users, oldest first. passwordHash is excluded by select:false
async function getAllUsers() {
  return User.find().sort({ userId: 1 });
}

// module.exports = { User, registerUser, loginUser, toAuthJSON, getAllUsers };

async function registerUser(data) {
  const { userName, email, password, postalCode, block, unitNumber, lat, lng } =
    data;

  if (password.length < 8) {
    throw httpError(400, "Password must be at least 8 characters");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  // Step 1: create the user first; duplicates/validation errors fail here,
  // before the counter is touched
  const user = await User.create({
    userName,
    email,
    passwordHash,
    postalCode,
    block,
    unitNumber,
    lat,
    lng,
  });

  // Step 2: only now take a number from the counter
  try {
    user.userId = await getNextSequence("userId");
    await user.save();
  } catch (err) {
    // don't leave a user without a userId behind
    await User.deleteOne({ _id: user._id });
    throw err;
  }

  return user;
}
// Finds a user by email and checks the password. Returns the user or throws.
async function loginUser(email, password) {
  if (!email || !password) {
    throw httpError(400, "Email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash",
  );
  const ok = user && (await bcrypt.compare(password, user.passwordHash));

  if (!ok) {
    throw httpError(401, "Invalid email or password");
  }

  return user;
}

async function applyTransactionToBalances(transactionId) {
  // Claim the transaction so the same one can never be applied twice
  const txn = await TokenTransaction.findOneAndUpdate(
    { transactionId, balanceApplied: { $ne: true } },
    { balanceApplied: true },
    { new: true },
  );
  if (!txn) {
    throw httpError(404, "Transaction not found or balance already updated");
  }

  const { senderId, receiverId, amount } = txn;
  let debited = false;

  try {
    // Debit sender (skipped for SYSTEM_GIFT). The $gte filter makes the
    // balance check and the deduction a single atomic operation.
    if (senderId) {
      const res = await User.updateOne(
        { userId: senderId, tokenBalance: { $gte: amount } },
        { $inc: { tokenBalance: -amount } },
      );
      if (res.modifiedCount === 0) {
        throw httpError(400, "Insufficient token balance or sender not found");
      }
      debited = true;
    }

    // Credit receiver (skipped for SHOP_PURCHASE)
    if (receiverId) {
      const res = await User.updateOne(
        { userId: receiverId },
        { $inc: { tokenBalance: amount } },
      );
      if (res.matchedCount === 0) {
        throw httpError(404, "Receiver not found");
      }
    }
  } catch (err) {
    // Undo whatever already happened so balances stay consistent
    if (debited) {
      await User.updateOne(
        { userId: senderId },
        { $inc: { tokenBalance: amount } },
      );
    }
    await TokenTransaction.updateOne(
      { _id: txn._id },
      { balanceApplied: false },
    );
    throw err;
  }

  const [sender, receiver] = await Promise.all([
    senderId
      ? User.findOne({ userId: senderId }).select("userId tokenBalance")
      : null,
    receiverId
      ? User.findOne({ userId: receiverId }).select("userId tokenBalance")
      : null,
  ]);

  return {
    transaction: txn,
    senderBalance: sender ? sender.tokenBalance : null,
    receiverBalance: receiver ? receiver.tokenBalance : null,
  };
}

// add to module.exports:
// applyTransactionToBalances,
// Shape of the user object that is safe to send to the client
function toAuthJSON(user) {
  return {
    id: user._id,
    userId: user.userId,
    userName: user.userName,
    email: user.email,
    userRole: user.userRole,
    tokenBalance: user.tokenBalance,
  };
}

module.exports = {
  User,
  getAllUsers,
  registerUser,
  loginUser,
  toAuthJSON,
  applyTransactionToBalances,
};
