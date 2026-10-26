const mongoose = require("mongoose");
const { getNextSequence } = require("./counterModel");
// import httpError the same way you do in userModel.js, e.g.:
// const { httpError } = require("../utils/httpError");

const reviewSchema = new mongoose.Schema({
  // assigned after the insert succeeds, so it can't be required here
  reviewId: { type: Number, unique: true, sparse: true },
  type: { type: String, enum: ["VISIT", "POST", "REVIEW"], required: true },
  visitId: { type: Number, default: null },
  postId: { type: Number, default: null },
  parentReviewId: { type: Number, default: null },
  creatorId: { type: Number, required: true },
  receiverId: { type: Number, required: true },
  rating: { type: Number, default: null, min: 1, max: 5 },
  comment: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  lastChangeAt: { type: Date, default: Date.now },
});

const httpError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};
// exactly one target id, matching the type
// exactly one target id, matching the type
reviewSchema.pre("validate", function () {
  const targets = {
    VISIT: this.visitId,
    POST: this.postId,
    REVIEW: this.parentReviewId,
  };
  const setFields = Object.values(targets).filter((v) => v != null).length;

  if (targets[this.type] == null || setFields !== 1) {
    throw httpError(
      400,
      `${this.type} review needs its own target id and no other`,
    );
  }

  if (this.type === "VISIT" && this.rating == null) {
    throw httpError(400, "VISIT review needs a rating");
  }
});
// only visits stay one-review-per-user
reviewSchema.index(
  { creatorId: 1, visitId: 1 },
  { unique: true, partialFilterExpression: { visitId: { $type: "number" } } },
);
// speed up the read functions below
reviewSchema.index({ visitId: 1 });
reviewSchema.index({ postId: 1 });
reviewSchema.index({ parentReviewId: 1 });
reviewSchema.index({ receiverId: 1 });
reviewSchema.index({ creatorId: 1 });

const Review = mongoose.model("Review", reviewSchema);

// ---------- create ----------

async function createReview(data) {
  const { type, visitId, postId, parentReviewId, creatorId, rating, comment } =
    data;
  let { receiverId } = data;

  // For replies, check the parent before inserting anything
  if (type === "REVIEW") {
    const parent = await Review.findOne({ reviewId: parentReviewId });
    if (!parent) {
      throw httpError(404, "Parent review not found");
    }
    if (parent.type === "REVIEW") {
      throw httpError(400, "Cannot reply to a reply");
    }
    if (parent.type !== "POST") {
      throw httpError(400, "Only post comments accept replies");
    }
    // the receiver is always the parent's creator, never trusted from the client
    receiverId = parent.creatorId;
  }

  // Step 1: create the review first; validation/duplicate errors fail here,
  // before the counter is touched
  const review = await Review.create({
    type,
    visitId: visitId ?? null,
    postId: postId ?? null,
    parentReviewId: parentReviewId ?? null,
    creatorId,
    receiverId,
    rating: rating ?? null,
    comment,
  });

  // Step 2: only now take a number from the counter
  try {
    review.reviewId = await getNextSequence("reviewId");
    await review.save();
  } catch (err) {
    // don't leave a review without a reviewId behind
    await Review.deleteOne({ _id: review._id });
    throw err;
  }

  return review;
}

// ---------- read ----------
// reviewId: { $ne: null } hides a review in the short window between
// Step 1 and Step 2 of createReview

async function getAllReviews() {
  return Review.find({ reviewId: { $ne: null } }).sort({ createdAt: -1 });
}

// Include thread context, while the client only lists records written by or
// addressed to this user. Replies themselves cannot have replies.
async function getProfileReviews(userId) {
  const own = await Review.find({
    reviewId: { $ne: null },
    $or: [{ creatorId: userId }, { receiverId: userId }],
  }).lean();
  const postComments = own.filter((review) => review.type === "POST").map((review) => review.reviewId);
  const parents = own.filter((review) => review.type === "REVIEW").map((review) => review.parentReviewId);
  const context = await Review.find({
    reviewId: { $ne: null },
    $or: [{ parentReviewId: { $in: postComments } }, { reviewId: { $in: parents } }],
  }).lean();
  const reviews = [...new Map([...own, ...context].map((review) => [review.reviewId, review])).values()];
  const ids = [...new Set(reviews.flatMap((review) => [review.creatorId, review.receiverId]))];
  const { User } = require("./userModel");
  // Read public profile fields only; photos belong to the author, not the receiver.
  const users = await User.find({ userId: { $in: ids } }).select("userId userName photoUrl -_id").lean();
  const names = new Map(users.map((user) => [user.userId, user.userName]));
  const photos = new Map(users.map((user) => [user.userId, user.photoUrl || ""]));
  return reviews.map((review) => ({
    ...review,
    creatorName: names.get(review.creatorId) || `User #${review.creatorId}`,
    creatorPhotoUrl: photos.get(review.creatorId) || "",
    receiverName: names.get(review.receiverId) || `User #${review.receiverId}`,
  }));
}

async function getReviewsByType(type) {
  return Review.find({ type, reviewId: { $ne: null } }).sort({ createdAt: -1 });
}

async function getReviewsByReceiver(receiverId) {
  return Review.find({ receiverId, reviewId: { $ne: null } }).sort({
    createdAt: -1,
  });
}

async function getReviewsByPost(postId) {
  return Review.find({ postId, reviewId: { $ne: null } }).sort({
    createdAt: -1,
  });
}

async function getReviewsByVisit(visitId) {
  return Review.find({ visitId, reviewId: { $ne: null } }).sort({
    createdAt: -1,
  });
}

// replies read oldest first, like a comment thread
async function getReviewsByParentReview(parentReviewId) {
  return Review.find({ parentReviewId, reviewId: { $ne: null } }).sort({
    createdAt: 1,
  });
}

// ---------- update ----------

// load + save so pre("validate") and min/max rating checks all run
async function updateReview(reviewId, { rating, comment }) {
  const review = await Review.findOne({ reviewId });
  if (!review) return null; // controller turns this into a 404

  if (rating !== undefined) review.rating = rating;
  if (comment !== undefined) review.comment = comment;
  review.lastChangeAt = new Date();

  return review.save();
}

module.exports = {
  Review,
  createReview,
  getAllReviews,
  getProfileReviews,
  getReviewsByType,
  getReviewsByReceiver,
  getReviewsByParentReview,
  getReviewsByPost,
  getReviewsByVisit,
  updateReview,
};
