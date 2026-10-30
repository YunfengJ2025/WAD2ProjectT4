const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const { getNextSequence } = require("./counterModel");
const { uploadImage, deleteImage, FOLDERS } = require("../config/cloudinary");
const { Review } = require("./reviewModel");
const userSchema = new mongoose.Schema(
  {
    userId: {
      type: Number,
      unique: true,
      sparse: true, // lets multiple documents exist without a userId
    },
    photoUrl: { type: String, default: "" },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      default: "",
    },
    photoPublicId: { type: String, default: "", select: false },
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
    // Reserved tokens remain part of tokenBalance but cannot fund another request.
    // Store them on the user so checking and freezing funds can use one atomic update.
    tokenReservations: {
      type: [
        {
          requestId: { type: Number, required: true },
          amount: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
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

// Total includes frozen tokens; available = total minus all outstanding reservations.
// Hide exhausted reservations and support older users without a reservations field.
function tokenSummary(user) {
  const reservations = (user.tokenReservations || []).filter(
    (item) => item.amount > 0,
  );
  const frozenTokenBalance = reservations.reduce(
    (sum, item) => sum + item.amount,
    0,
  );
  return {
    tokenBalance: user.tokenBalance,
    frozenTokenBalance,
    availableTokenBalance: user.tokenBalance - frozenTokenBalance,
    tokenReservations: reservations.map(({ requestId, amount }) => ({
      requestId,
      amount,
    })),
  };
}

async function reserveTokens(userId, requestId, amount) {
  if (!Number.isSafeInteger(amount) || amount < 1)
    throw httpError(400, "Invalid total reward");
  // Check available funds and reserve them in the same database operation.
  // Reading the balance first would let simultaneous requests spend the same tokens.
  const result = await User.updateOne(
    {
      userId,
      "tokenReservations.requestId": { $ne: requestId }, // Prevent duplicate reservations.
      $expr: {
        $gte: [
          {
            $subtract: [
              "$tokenBalance",
              { $sum: { $ifNull: ["$tokenReservations.amount", []] } },
            ],
          },
          amount,
        ],
      },
    },
    { $push: { tokenReservations: { requestId, amount } } },
  );
  if (!result.modifiedCount)
    throw httpError(
      400,
      "Insufficient available tokens for all visits in this request",
    );
}

async function releaseTokens(userId, requestId, amount) {
  // Cancellation releases a specific amount, retaining rewards for completed unpaid visits.
  // Omit amount to remove the whole reservation when rolling back failed request creation.
  if (amount !== undefined) {
    await User.updateOne(
      {
        userId,
        tokenReservations: {
          $elemMatch: { requestId, amount: { $gte: amount } },
        },
      },
      { $inc: { "tokenReservations.$.amount": -amount } },
    );
    return;
  }
  await User.updateOne(
    { userId },
    { $pull: { tokenReservations: { requestId } } },
  );
}

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

// Updates the logged-in user's own details. Only these fields can be changed,
// so callers can't edit userRole, tokenBalance, etc.
const EDITABLE_FIELDS = [
  "userName",
  "email",
  "postalCode",
  "block",
  "unitNumber",
  "bio",
];

async function updateProfile(user, data, file) {
  for (const field of EDITABLE_FIELDS) {
    if (data[field] !== undefined) {
      if (typeof data[field] !== "string")
        throw httpError(400, `${field} must be text`);
      user[field] = data[field].trim();
    }
  }
  if (user.isModified("postalCode") || user.isModified("block")) {
    // Coordinates from the old address must not be reused for nearby searches.
    user.lat = undefined;
    user.lng = undefined;
  }
  await user.validate();
  if (!file) return user.save();

  // The public id is excluded from normal reads and all client responses.
  const previous = await User.findById(user._id).select("+photoPublicId");
  const photo = await uploadImage(file.buffer, FOLDERS.userIcon);
  user.photoUrl = photo.url;
  user.photoPublicId = photo.publicId;
  try {
    await user.save();
  } catch (err) {
    await deleteImage(photo.publicId);
    throw err;
  }
  await deleteImage(previous?.photoPublicId);
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

  const { senderId, receiverId, amount, requestId } = txn;
  let debited = false;

  try {
    // Care payments consume this request's reserved funds. Reduce total and frozen
    // tokens together so the owner's available balance stays unchanged by the payout.
    // System gifts have no sender and skip this debit.
    if (senderId) {
      const res = await User.updateOne(
        {
          userId: senderId,
          tokenBalance: { $gte: amount },
          tokenReservations: {
            $elemMatch: { requestId, amount: { $gte: amount } },
          },
        },
        {
          $inc: {
            tokenBalance: -amount,
            "tokenReservations.$.amount": -amount,
          },
        },
      );
      if (res.modifiedCount === 0) {
        throw httpError(
          400,
          "Care request has insufficient reserved tokens or its owner was not found",
        );
      }
      debited = true;
    }

    // Credit the sitter or system-gift recipient.
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
      // Restore both the owner's total and reservation if crediting the sitter failed.
      await User.updateOne(
        { userId: senderId, "tokenReservations.requestId": requestId },
        {
          $inc: { tokenBalance: amount, "tokenReservations.$.amount": amount },
        },
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

async function getPublicProfile(userId) {
  const user = await User.findOne({ userId })
    .select("userId userName photoUrl bio createdAt -_id")
    .lean();
  if (!user) return null;
  // Public feedback contains only completed, received care-visit reviews.
  const reviews = await Review.find({
    receiverId: userId,
    type: "VISIT",
    reviewId: { $ne: null },
  })
    .sort({ createdAt: -1 })
    .select("reviewId creatorId rating comment createdAt -_id")
    .lean();
  const authors = await User.find({
    userId: { $in: [...new Set(reviews.map((item) => item.creatorId))] },
  })
    .select("userId userName photoUrl -_id")
    .lean();
  const byId = new Map(authors.map((author) => [author.userId, author]));
  const ratings = reviews
    .map((review) => review.rating)
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  return {
    user: {
      userId: user.userId,
      userName: user.userName,
      photoUrl: user.photoUrl || "",
      bio: user.bio || "",
      createdAt: user.createdAt,
    },
    reviewCount: reviews.length,
    averageRating: ratings.length
      ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
      : null,
    reviews: reviews.map((review) => ({
      reviewId: review.reviewId,
      creatorId: review.creatorId,
      type: "VISIT",
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      creatorName: byId.get(review.creatorId)?.userName || "Former neighbour",
      creatorPhotoUrl: byId.get(review.creatorId)?.photoUrl || "",
      receiverName: user.userName,
    })),
  };
}

// add to module.exports:
// Shape of the user object that is safe to send to the client
function toAuthJSON(user) {
  return {
    id: user._id,
    userId: user.userId,
    userName: user.userName,
    email: user.email,
    userRole: user.userRole,
    ...tokenSummary(user),
    postalCode: user.postalCode,
    block: user.block,
    unitNumber: user.unitNumber,
    photoUrl: user.photoUrl || "",
    bio: user.bio || "",
    createdAt: user.createdAt,
  };
}

module.exports = {
  tokenSummary,
  reserveTokens,
  releaseTokens,
  User,
  getAllUsers,
  registerUser,
  loginUser,
  toAuthJSON,
  updateProfile,
  applyTransactionToBalances,
  getPublicProfile,
};
