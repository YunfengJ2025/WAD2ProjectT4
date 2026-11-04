const Notification = require("../models/notificationModel");
const tokenModel = require("../models/tokenModel");
const userModel = require("../models/userModel");

// Create an in-app notification for a single account.
function notifyUser(userId, type, message, visitId, requestId = null) {
  return Notification.create({ userId, type, message, visitId, requestId });
}

// Burn up to the visit reward, capped by the sitter's available token balance.
async function burnSitterPenalty({ sitterId, visitId, requestId, requestedAmount }) {
  if (!Number.isSafeInteger(requestedAmount) || requestedAmount < 1) return 0;
  const sitter = await userModel.User.findOne({ userId: sitterId })
    .select("tokenBalance tokenReservations").lean();
  if (!sitter) return 0;
  // Cap the penalty at available funds; the token backend checks this balance
  // atomically again when applying the debit, protecting frozen care rewards.
  const amount = Math.min(requestedAmount, Math.max(0, userModel.tokenSummary(sitter).availableTokenBalance));
  if (!amount) return 0;
  const txn = await tokenModel.createTransaction({
    visitId,
    requestId,
    reason: `Penalty for missed or late-cancelled visit #${visitId}`,
    type: "PENALTY",
    senderId: sitterId,
    receiverId: null,
    amount,
  });
  try {
    // Use the same transaction-to-balance path as POST /token/. Do not debit
    // separately or mark the transaction applied before this call succeeds.
    await userModel.applyTransactionToBalances(txn.transactionId);
    return amount;
  } catch (err) {
    // Balance application handles rollback; remove the unpaid ledger record too.
    await tokenModel.TokenTransaction.deleteOne({ _id: txn._id });
    throw err;
  }
}

// Convert a visit's stored date into the start and end of that Singapore day.
function singaporeDayBounds(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const dayStart = new Date(Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)) - 8 * 60 * 60 * 1000);
  return {
    dayStart,
    dayEnd: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1),
  };
}

function singaporeDateLabel(date) {
  return new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

module.exports = { notifyUser, burnSitterPenalty, singaporeDayBounds, singaporeDateLabel };
