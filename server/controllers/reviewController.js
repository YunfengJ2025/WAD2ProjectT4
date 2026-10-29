const reviewModel = require("../models/reviewModel");

const TYPES = ["VISIT", "POST", "REVIEW"];

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

// parses a positive integer id from params/body, throws 400 if invalid
function parseId(value, name) {
  const n = Number(value);
  if (value === undefined || value === null || !Number.isInteger(n) || n < 1) {
    throw badRequest(`${name} must be a positive integer`);
  }
  return n;
}

// same optional-id rule, but null/undefined is allowed
function parseOptionalId(value, name) {
  if (value === undefined || value === null) return null;
  return parseId(value, name);
}

function handleError(res, err) {
  if (err.status || err.statusCode) {
    return res
      .status(err.status || err.statusCode)
      .json({ message: err.message });
  }
  if (err.code === 11000) {
    return res
      .status(409)
      .json({ message: "You have already reviewed this visit" });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }
  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
}

// POST /review
async function createReview(req, res) {
  try {
    const { type, comment, rating } = req.body;
    if (!TYPES.includes(type)) {
      throw badRequest(`type must be one of ${TYPES.join(", ")}`);
    }

    const creatorId = parseId(req.body.creatorId, "creatorId");
    const visitId = parseOptionalId(req.body.visitId, "visitId");
    const postId = parseOptionalId(req.body.postId, "postId");
    const parentReviewId = parseOptionalId(
      req.body.parentReviewId,
      "parentReviewId",
    );

    // receiverId is only needed for VISIT and POST; for REVIEW the model
    // takes it from the parent review
    const receiverId =
      type === "REVIEW" ? null : parseId(req.body.receiverId, "receiverId");

    if (rating !== undefined && rating !== null) {
      if (typeof rating !== "number" || rating < 1 || rating > 5) {
        throw badRequest("rating must be a number between 1 and 5");
      }
    }

    // reviewId from the client is ignored on purpose
    const review = await reviewModel.createReview({
      type,
      visitId,
      postId,
      parentReviewId,
      creatorId,
      receiverId,
      rating,
      comment,
    });

    return res.status(201).json(review);
  } catch (err) {
    return handleError(res, err);
  }
}

// GET /review
async function getAllReviews(req, res) {
  try {
    return res.json(await reviewModel.getAllReviews());
  } catch (err) {
    return handleError(res, err);
  }
}

// GET /review/type/:type
async function getReviewsByType(req, res) {
  try {
    const { type } = req.params;
    if (!TYPES.includes(type)) {
      throw badRequest(`type must be one of ${TYPES.join(", ")}`);
    }
    return res.json(await reviewModel.getReviewsByType(type));
  } catch (err) {
    return handleError(res, err);
  }
}

// GET /review/receiver/:receiverId
async function getReviewsByReceiver(req, res) {
  try {
    const receiverId = parseId(req.params.receiverId, "receiverId");
    return res.json(await reviewModel.getReviewsByReceiver(receiverId));
  } catch (err) {
    return handleError(res, err);
  }
}

// GET /review/post/:postId
// Return the post thread, including replies and public author details for the shared review card.
async function getReviewsByPost(req, res) {
  try {
    const postId = parseId(req.params.postId, "postId");
    // Load the post's comments, then their replies using the parent review IDs.
    // Attach public author details so ReviewCard can display the complete thread.
    const comments = await reviewModel.getReviewsByPost(postId);
    const replies = await reviewModel.Review.find({ parentReviewId: { $in: comments.map(review => review.reviewId) }, reviewId: { $ne: null } }).sort({ createdAt: 1 });
    const records = [...comments, ...replies];
    const { User } = require("../models/userModel");
    const users = await User.find({ userId: { $in: [...new Set(records.map(review => review.creatorId))] } }).select("userId userName photoUrl").lean();
    return res.json(records.map(review => {
      const data = review.toObject ? review.toObject() : review;
      const user = users.find(user => user.userId === data.creatorId);
      return { ...data, creatorName: user?.userName || 'User #' + data.creatorId, creatorPhoto: user?.photoUrl || "" };
    }));
  } catch (err) {
    return handleError(res, err);
  }
}

// GET /review/visit/:visitId
async function getReviewsByVisit(req, res) {
  try {
    const visitId = parseId(req.params.visitId, "visitId");
    return res.json(await reviewModel.getReviewsByVisit(visitId));
  } catch (err) {
    return handleError(res, err);
  }
}

// GET /review/replies/:parentReviewId
async function getReviewsByParentReview(req, res) {
  try {
    const parentReviewId = parseId(req.params.parentReviewId, "parentReviewId");
    return res.json(await reviewModel.getReviewsByParentReview(parentReviewId));
  } catch (err) {
    return handleError(res, err);
  }
}

// PUT /review/:reviewId   body: { creatorId, rating?, comment? }
async function updateReview(req, res) {
  try {
    const reviewId = parseId(req.params.reviewId, "reviewId");
    const creatorId = parseId(req.body.creatorId, "creatorId");
    const { rating, comment } = req.body;

    if (rating !== undefined && rating !== null) {
      if (typeof rating !== "number" || rating < 1 || rating > 5) {
        throw badRequest("rating must be a number between 1 and 5");
      }
    }

    // only the creator can edit their own review
    const existing = await reviewModel.Review.findOne({ reviewId });
    if (!existing) {
      return res.status(404).json({ message: "Review not found" });
    }
    if (existing.creatorId !== creatorId) {
      return res
        .status(403)
        .json({ message: "You can only edit your own review" });
    }

    const updated = await reviewModel.updateReview(reviewId, {
      rating,
      comment,
    });
    return res.json(updated);
  } catch (err) {
    return handleError(res, err);
  }
}

module.exports = {
  async getMyReviews(req, res) {
    try {
      return res.json({ reviews: await reviewModel.getProfileReviews(req.userId) });
    } catch (err) {
      return handleError(res, err);
    }
  },
  async replyAsUser(req, res) {
    try {
      const parentReviewId = parseId(req.body.parentReviewId, "parentReviewId");
      if (typeof req.body.comment !== "string" || !req.body.comment.trim() || req.body.comment.length > 1000) {
        throw badRequest("Reply must contain between 1 and 1000 characters");
      }
      const reply = await reviewModel.createReview({
        type: "REVIEW", parentReviewId, creatorId: req.userId, comment: req.body.comment.trim(),
      });
      return res.status(201).json(reply);
    } catch (err) {
      return handleError(res, err);
    }
  },
  createReview,
  getAllReviews,
  getReviewsByType,
  getReviewsByReceiver,
  getReviewsByPost,
  getReviewsByVisit,
  getReviewsByParentReview,
  updateReview,
};
