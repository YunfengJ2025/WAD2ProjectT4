const mongoose = require("mongoose");
const Counter = require("./counterModel");

// Gifts create a credit; care rewards transfer tokens already reserved by the owner.
const TRANSACTION_TYPES = ["SYSTEM_GIFT", "CARE"];

const tokenTransactionSchema = new mongoose.Schema({
  transactionId: { type: Number, unique: true, sparse: true }, // PK, auto-incremented
  visitId: { type: Number, ref: "Visit", default: null }, // FK (optional)
  requestId: { type: Number, default: null }, // Links a care payout to the owner's reservation.
  reason: { type: String, required: true, trim: true },
  senderId: { type: Number, ref: "User", default: null }, // FK (optional)
  receiverId: { type: Number, ref: "User", default: null },
  amount: {
    type: Number,
    required: true,
    min: [1, "Amount must be at least 1"],
  },
  type: {
    type: String,
    required: true,
    enum: {
      values: TRANSACTION_TYPES,
      message: "Invalid transaction type: {VALUE}",
    },
  },
  balanceApplied: { type: Boolean, default: false },
  createdAt: { type: Date, required: true, default: Date.now },
});

// MongoDB enforces one care transaction per visit, even for simultaneous claims.
// Exclude system gifts because they do not belong to a visit.
tokenTransactionSchema.index(
  { visitId: 1 },
  { unique: true, partialFilterExpression: { type: "CARE" } },
);

const TokenTransaction = mongoose.model(
  "TokenTransaction",
  tokenTransactionSchema,
);

// Errors with a status are turned into proper HTTP responses by handleError
function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

async function createTransaction({
  visitId,
  requestId,
  reason,
  type,
  senderId,
  receiverId,
  amount,
}) {
  if (senderId && senderId === receiverId) {
    throw badRequest("Sender and receiver cannot be the same user");
  }
  if (type === "SYSTEM_GIFT" && (senderId || !receiverId)) {
    throw badRequest("System gifts need a receiver and cannot have a sender");
  }
  if (!TRANSACTION_TYPES.includes(type))
    throw badRequest("Invalid transaction type");
  if (!Number.isSafeInteger(amount) || amount < 1)
    throw badRequest("Amount must be a positive whole number");
  if (type === "CARE" && (!senderId || !receiverId || !visitId || !requestId)) {
    throw badRequest(
      "Care transactions need a sender, a receiver, a visitId and a requestId",
    );
  }

  const token = await TokenTransaction.create({
    visitId,
    requestId,
    reason,
    type,
    senderId,
    receiverId,
    amount,
  });

  // Only after a successful insert, take the next ID from the counter
  try {
    token.transactionId = await Counter.getNextSequence("transactionId");
    await token.save();
  } catch (err) {
    // don't leave a transaction without a transactionId behind
    await TokenTransaction.deleteOne({ _id: token._id });
    throw err;
  }

  return token;
}

async function getAllTransactions() {
  return TokenTransaction.find().sort({ createdAt: -1 });
}

async function getTransactionsByType(type) {
  if (!TRANSACTION_TYPES.includes(type)) {
    throw badRequest(`Invalid transaction type: ${type}`);
  }
  return TokenTransaction.find({ type }).sort({ createdAt: -1 });
}

async function getTransactionsByUser(userId) {
  return TokenTransaction.find({
    $or: [{ senderId: userId }, { receiverId: userId }],
  }).sort({ createdAt: -1 });
}

async function getTransactionsByVisit(visitId) {
  return TokenTransaction.find({ visitId }).sort({ createdAt: -1 });
}

module.exports = {
  TRANSACTION_TYPES,
  TokenTransaction,
  createTransaction,
  getAllTransactions,
  getTransactionsByType,
  getTransactionsByUser,
  getTransactionsByVisit,
};
