import express from "express";
import {
  createPost,
  getFeed,
  getUserPosts,
  getPostById,
  updatePost,
  deletePost,
  toggleLike,
  createComment,
  getComments,
  deleteComment,
} from "./post.controller.js";
import { protect, optionalProtect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

// Public / Optionally Authenticated routes
router.get("/feed", optionalProtect, getFeed);
router.get("/user/:username", optionalProtect, getUserPosts);
router.get("/:id", optionalProtect, getPostById);
router.get("/:id/comments", optionalProtect, getComments);

// Protected routes (Require login)
router.post("/", protect, createPost);
router.put("/:id", protect, updatePost);
router.delete("/:id", protect, deletePost);
router.post("/:id/like", protect, toggleLike);

// Comment routes
router.post("/:id/comments", protect, createComment);
router.delete("/comments/:id", protect, deleteComment);

export default router;
