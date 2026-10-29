const images = require("../config/cloudinary");
const reviews = require("../models/reviewModel");
const { User } = require("../models/userModel");
const posts = require("../models/postModel");

function parseId(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw posts.httpError(400, "postId must be a positive integer");
  }
  return Number(value);
}

function handleError(res, err) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  if (["ValidationError", "CastError"].includes(err.name)) {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 11000) return res.status(409).json({ message: "Record already exists; retry the request" });
  console.error(err);
  return res.status(500).json({ message: "Internal server error" });
}

async function createPost(req, res) {
  const uploaded = [];
  try {
    const { title, content } = req.body || {};
    if (typeof content !== "string" || !content.trim()) {
      throw posts.httpError(400, "content must be a non-empty string");
    }
    if (typeof title !== "string" || !title.trim() || title.trim().length > 150) {
      throw posts.httpError(400, "title must contain between 1 and 150 characters");
    }
    for (const file of req.files || []) uploaded.push(await images.uploadImage(file.buffer, images.FOLDERS.postImage));
    const post = await posts.createPost({
      creatorId: req.userId, title: title.trim(), content: content.trim(),
      ...(uploaded.length ? { postImages: uploaded.map(image => image.url),  } : {}),
    });
    const result = post.toObject ? post.toObject() : post;
    return res.status(201).json(result);
  } catch (err) {
    await Promise.all(uploaded.map(image => images.deleteImage(image.publicId)));
    return handleError(res, err);
  }
}

async function getAllPosts(req, res) {
  try { return res.json(await withAuthors(await posts.getAllPosts())); }
  catch (err) { return handleError(res, err); }
}

async function getPost(req, res) {
  try {
    const post = await posts.getPost(parseId(req.params.postId));
    if (!post) throw posts.httpError(404, "Post not found");
    return res.json((await withAuthors([post]))[0]);
  } catch (err) { return handleError(res, err); }
}

async function withAuthors(records) {
  const users = await User.find({ userId: { $in: [...new Set(records.map(record => record.creatorId))] } }).select("userId userName photoUrl").lean();
  return records.map(record => {
    const data = record.toObject ? record.toObject() : record;
    const user = users.find(user => user.userId === data.creatorId);
    return { ...data, creatorName: user?.userName || 'User #' + data.creatorId, creatorPhoto: user?.photoUrl || "" };
  });
}
async function createPostReview(req, res) {
  try {
    const postId = parseId(req.params.postId);
    const comment = req.body?.comment;
    if (typeof comment !== "string" || !comment.trim() || comment.length > 1000) throw posts.httpError(400, "Review must contain between 1 and 1000 characters");
    const post = await posts.getPost(postId);
    if (!post) throw posts.httpError(404, "Post not found");
    const review = await reviews.createReview({ type: "POST", postId, creatorId: req.userId, receiverId: post.creatorId, comment: comment.trim() });
    return res.status(201).json((await withAuthors([review]))[0]);
  } catch (err) { return handleError(res, err); }
}
module.exports = { createPostReview, createPost, getAllPosts, getPost, parseId, handleError };
