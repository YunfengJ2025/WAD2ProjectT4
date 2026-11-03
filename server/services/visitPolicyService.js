const Notification = require("../models/notificationModel");
const tokenModel = require("../models/tokenModel");
const { User, deductAvailableTokens } = require("../models/userModel");

// Create an in-app notification for a single account.
function notifyUser(userId, type, message, visitId) {
  return Notification.create({ userId, type, message, visitId });
}

// Burn up to the visit reward, capped by the sitter's available token balance.
async function burnSitterPenalty({ sitterId, visitId, requestId, requestedAmount }) {
  const amount = await deductAvailableTokens(sitterId, requestedAmount);
  if (!amount) return 0;
  try {
    await tokenModel.createTransaction({
      visitId,
      requestId,
      reason: `Penalty for missed or late-cancelled visit #${visitId}`,
      type: "PENALTY",
      senderId: sitterId,
      receiverId: null,
      amount,
      balanceApplied: true,
    });
    return amount;
  } catch (err) {
    await User.updateOne({ userId: sitterId }, { $inc: { tokenBalance: amount } });
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
