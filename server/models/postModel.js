const mongoose = require("mongoose");
const counter = require("./counterModel");
const { User } = require("./userModel");

const postSchema = new mongoose.Schema({
  postId: { type: Number, unique: true, sparse: true },
  creatorId: { type: Number, required: true },
  content: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  postImages: { type: [String], default: [] },
  likedCount: { type: Number, default: 0, min: 0 },
});
postSchema.index({ creatorId: 1 });
const Post = mongoose.model("Post", postSchema);

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function createPost({ creatorId, title, content, postImages }) {
  return mongoose.connection.transaction(async (session) => {
    if (!await User.exists({ userId: creatorId }).session(session)) {
      throw httpError(404, "Creator not found");
    }
    // Insert first, as in createReview. Roll back the counter too if saving fails.
    const [post] = await Post.create([{ creatorId, title, content, postImages }], { session });
    post.postId = await counter.getNextSequence("postId", session);
    await post.save({ session });
    return post;
  });
}

async function getAllPosts() {
  return Post.find({ postId: { $ne: null } }).sort({ postId: -1 });
}

async function getPost(postId) {
  return Post.findOne({ postId });
}

module.exports = { Post, createPost, getAllPosts, getPost, httpError };
