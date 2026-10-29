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

async function getMyPosts(creatorId) {
  return Post.find({ creatorId, postId: { $ne: null } }).sort({ postId: -1 });
}
async function updatePost(postId, creatorId, data) {
  const post = await Post.findOneAndUpdate({ postId, creatorId }, { $set: data }, { new: true, runValidators: true });
  if (!post) throw httpError(404, "Post not found or you do not own it");
  return post;
}
async function deletePost(postId, creatorId) {
  return mongoose.connection.transaction(async session => {
    const post = await Post.findOneAndDelete({ postId, creatorId }, { session });
    if (!post) throw httpError(404, "Post not found or you do not own it");
    const { Review } = require('./reviewModel');
    const { Like } = require('./likeModel');
    const comments = await Review.find({ postId }).session(session);
    await Review.deleteMany({ $or: [{ postId }, { parentReviewId: { $in: comments.map(review => review.reviewId) } }] }, { session });
    await Like.deleteMany({ postId }, { session });
    return post;
  });
}
module.exports = { getMyPosts, updatePost, deletePost, Post, createPost, getAllPosts, getPost, httpError };
