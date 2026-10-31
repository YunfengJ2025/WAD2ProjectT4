const likes = require("../models/likeModel");
const { parseId, handleError } = require("./postController");

function changeLike(liked) {
  return async (req, res) => {
    try {
      return res.json(await likes.setLiked(parseId(req.params.postId), req.userId, liked));
    } catch (err) { return handleError(res, err); }
  };
}

module.exports = { likePost: changeLike(true), unlikePost: changeLike(false) };
