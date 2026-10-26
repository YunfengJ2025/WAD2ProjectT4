const router = require("express").Router();
const posts = require("../controllers/postController");
const requireUser = require("../middleware/requireUser");

router.get("/", posts.getAllPosts);
router.get("/:postId", posts.getPost);
router.post("/", requireUser, posts.createPost);
router.use("/:postId/like", require("./likeRoute"));

module.exports = router;
