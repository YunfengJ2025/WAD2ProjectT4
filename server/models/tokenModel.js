const mongoose = require("mongoose");
const Counter = require("./counterModel"); // adjust to match your counter model's export

const tokenTransactionSchema = new mongoose.Schema({
  transactionId: { type: Number, unique: true, sparse: true }, // PK, auto-incremented
  visitId: { type: Number, ref: "Visit", default: null }, // FK (optional)
  reason: { type: String, required: true, trim: true },
  senderId: { type: Number, ref: "User", default: null }, // FK (optional)
  receiverId: { type: Number, ref: "User", required: true }, // FK
  amount: {
    type: Number,
    required: true,
    min: [1, "Amount must be at least 1"],
  },
  createdAt: { type: Date, required: true, default: Date.now },
});

const TokenTransaction = mongoose.model(
  "TokenTransaction",
  tokenTransactionSchema,
);

// Same pattern as your userId counter: $inc and upsert so the first value is 1
async function getNextTransactionId() {
  const counter = await Counter.getNextSequence("transactionId");
  return counter;
}

async function createTransaction({
  visitId,
  reason,
  senderId,
  receiverId,
  amount,
}) {
  if (senderId && senderId === receiverId) {
    throw new Error("Sender and receiver cannot be the same user");
  }

  // 1. Insert without transactionId. Mongoose validation runs here,
  //    so the counter is untouched if the data is invalid.
  const token = await TokenTransaction.create({
    visitId,
    reason,
    senderId,
    receiverId,
    amount,
    // createdAt auto-fills via the schema default
  });

  // 2. Only after a successful insert, take the next ID from the counter
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

async function getTransactionsByUser(userId) {
  return TokenTransaction.find({
    $or: [{ senderId: userId }, { receiverId: userId }],
  }).sort({ createdAt: -1 });
}

async function getTransactionsByVisit(visitId) {
  return TokenTransaction.find({ visitId }).sort({ createdAt: -1 });
}

module.exports = {
  TokenTransaction,
  createTransaction,
  getTransactionsByUser,
  getTransactionsByVisit,
};
