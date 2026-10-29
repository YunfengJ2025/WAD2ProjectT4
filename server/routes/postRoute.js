const router = require("express").Router();
const posts = require("../controllers/postController");
const requireUser = require("../middleware/requireUser");

router.get("/", posts.getAllPosts);
router.post("/:postId/reviews", requireUser, posts.createPostReview);
router.get("/:postId", posts.getPost);
router.post(
  "/",
  requireUser,
  require("../middleware/uploadPostPhotos"),
  posts.createPost,
);
router.use("/:postId/like", require("./likeRoute"));

module.exports = router;
