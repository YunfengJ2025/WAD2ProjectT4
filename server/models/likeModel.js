const mongoose = require("mongoose");
const { Post, httpError } = require("./postModel");
const { User } = require("./userModel");

const likeSchema = new mongoose.Schema({
  creatorId: { type: Number, required: true },
  postId: { type: Number, required: true },
  likedAt: { type: Date, default: Date.now },
});
// MongoDB equivalent of the composite primary key (creatorId, postId).
likeSchema.index({ creatorId: 1, postId: 1 }, { unique: true });
likeSchema.index({ postId: 1 });
const Like = mongoose.model("Like", likeSchema);

async function setLiked(postId, creatorId, liked) {
  return mongoose.connection.transaction(async (session) => {
    const post = await Post.findOne({ postId }).session(session);
    if (!post) throw httpError(404, "Post not found");
    if (!await User.exists({ userId: creatorId }).session(session)) {
      throw httpError(404, "Creator not found");
    }
    const filter = { creatorId, postId };
    let change;
    if (liked) {
      const result = await Like.updateOne(filter, { $setOnInsert: {
        creatorId, postId, likedAt: new Date(),
      } }, { upsert: true, session });
      change = result.upsertedCount ? 1 : 0;
    } else {
      const result = await Like.deleteOne(filter, { session });
      change = result.deletedCount ? -1 : 0;
    }
    if (change) {
      post.likedCount += change;
      await post.save({ session });
    }
    return { postId, liked, likedCount: post.likedCount };
  });
}

// Return only the signed-in user's likes, newest first; deleted posts are omitted.
async function getLikedPosts(creatorId) {
  const likes = await Like.find({ creatorId }).sort({ likedAt: -1, _id: -1 }).lean();
  const posts = await Post.find({ postId: { $in: likes.map(like => like.postId) } }).lean();
  const byId = new Map(posts.map(post => [post.postId, post]));
  return likes.filter(like => byId.has(like.postId)).map(like => ({ ...byId.get(like.postId), likedAt: like.likedAt, liked: true }));
}
module.exports = { Like, setLiked, getLikedPosts };
