const router = require("express").Router();
const posts = require("../controllers/postController");
const requireUser = require("../middleware/requireUser");

router.get('/me', requireUser, posts.getMyPosts);
router.patch('/:postId', requireUser, require('../middleware/uploadPostPhotos'), posts.updatePost);
router.delete('/:postId', requireUser, posts.deletePost);
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
