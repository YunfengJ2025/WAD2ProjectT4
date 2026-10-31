const mongoose = require("mongoose");
const counter = require("./counterModel");
const { User } = require("./userModel");

// Store the post's author, text and uploaded image URLs.
// postId comes from the counter; likedCount is maintained by the like model.
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

// Insert the post before allocating its public ID; failures must not consume the counter.

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

// Scope the listing to the authenticated creator rather than accepting an owner ID from the client.

async function getMyPosts(creatorId) {
  return Post.find({ creatorId, postId: { $ne: null } }).sort({ postId: -1 });
}
// Restrict updates to the owner and allow only validated editable post fields.
async function updatePost(postId, creatorId, data) {
  const post = await Post.findOneAndUpdate({ postId, creatorId }, { $set: data }, { new: true, runValidators: true });
  if (!post) throw httpError(404, "Post not found or you do not own it");
  return post;
}
// Delete the owned post and its discussion and likes together to avoid orphaned records.
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
