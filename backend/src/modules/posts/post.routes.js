import express from "express";
import {
  createPost,
  getFeed,
  getTrendingTopics,
  getUserPosts,
  getPostById,
  recordPostView,
  updatePost,
  deletePost,
  toggleLike,
  createComment,
  getComments,
  deleteComment,
  toggleCommentLike,
  toggleBookmark,
  getBookmarks,
} from "./post.controller.js";
import { protect, optionalProtect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

// Bookmarks route (placed before /:id)
router.get("/bookmarks/all", protect, getBookmarks);

// Trending route (placed before /:id)
router.get("/trending", optionalProtect, getTrendingTopics);

// Public / Optionally Authenticated routes
router.get("/feed", optionalProtect, getFeed);
router.get("/user/:username", optionalProtect, getUserPosts);
router.get("/user/:username/replies", optionalProtect, (req, res, next) => {
  req.query.tab = "replies";
  return getUserPosts(req, res, next);
});
router.get("/user/:username/likes", optionalProtect, (req, res, next) => {
  req.query.tab = "likes";
  return getUserPosts(req, res, next);
});
router.get("/user/:username/media", optionalProtect, (req, res, next) => {
  req.query.tab = "media";
  return getUserPosts(req, res, next);
});
router.get("/:id", optionalProtect, getPostById);
router.post("/:id/view", optionalProtect, recordPostView);
router.get("/:id/comments", optionalProtect, getComments);

// Protected routes (Require login)
router.post("/", protect, createPost);
router.put("/:id", protect, updatePost);
router.delete("/:id", protect, deletePost);
router.post("/:id/like", protect, toggleLike);
router.post("/:id/bookmark", protect, toggleBookmark);

// Comment routes
router.post("/:id/comments", protect, createComment);
router.delete("/comments/:id", protect, deleteComment);
router.post("/comments/:id/like", protect, toggleCommentLike);

export default router;
