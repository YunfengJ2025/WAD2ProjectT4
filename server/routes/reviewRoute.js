const express = require("express");
const reviewController = require("../controllers/reviewController");

const router = express.Router();

router.post("/", reviewController.createReview);
router.get("/", reviewController.getAllReviews);
router.get("/type/:type", reviewController.getReviewsByType);
router.get("/receiver/:receiverId", reviewController.getReviewsByReceiver);
router.get("/post/:postId", reviewController.getReviewsByPost);
router.get("/visit/:visitId", reviewController.getReviewsByVisit);
router.get(
  "/replies/:parentReviewId",
  reviewController.getReviewsByParentReview,
);
router.put("/:reviewId", reviewController.updateReview);

module.exports = router;
