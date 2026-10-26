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
  try {
    const { content, postImage } = req.body || {};
    if (typeof content !== "string" || !content.trim()) {
      throw posts.httpError(400, "content must be a non-empty string");
    }
    if (postImage !== undefined && typeof postImage !== "string") {
      throw posts.httpError(400, "postImage must be an image URL string");
    }
    return res.status(201).json(await posts.createPost({
      creatorId: req.userId, content: content.trim(), postImage,
    }));
  } catch (err) { return handleError(res, err); }
}

async function getAllPosts(req, res) {
  try { return res.json(await posts.getAllPosts()); }
  catch (err) { return handleError(res, err); }
}

async function getPost(req, res) {
  try {
    const post = await posts.getPost(parseId(req.params.postId));
    if (!post) throw posts.httpError(404, "Post not found");
    return res.json(post);
  } catch (err) { return handleError(res, err); }
}

module.exports = { createPost, getAllPosts, getPost, parseId, handleError };
