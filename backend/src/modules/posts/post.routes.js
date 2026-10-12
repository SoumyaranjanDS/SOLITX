import express from "express";
import {
  createPost,
  getFeed,
  getUserPosts,
  getPostById,
  updatePost,
  deletePost,
  toggleLike,
} from "./post.controller.js";
import { protect, optionalProtect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

// Public / Optionally Authenticated routes
router.get("/feed", optionalProtect, getFeed);
router.get("/user/:username", optionalProtect, getUserPosts);
router.get("/:id", optionalProtect, getPostById);

// Protected routes (Require login)
router.post("/", protect, createPost);
router.put("/:id", protect, updatePost);
router.delete("/:id", protect, deletePost);
router.post("/:id/like", protect, toggleLike);

export default router;
