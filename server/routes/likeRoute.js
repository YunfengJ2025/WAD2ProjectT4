const router = require("express").Router({ mergeParams: true });
const likes = require("../controllers/likeController");
const requireUser = require("../middleware/requireUser");

router.post("/", requireUser, likes.likePost);
router.delete("/", requireUser, likes.unlikePost);

module.exports = router;
