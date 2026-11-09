import { Router } from "express";
import { protect } from "../../middlewares/authMiddleware.js";
import {
  initiateUpload,
  getPartUrls,
  completeUpload,
  abortUpload,
  getVideoStatus,
  getVideoById,
} from "./video.controller.js";

const router = Router();

// Protected upload workflow
router.post("/initiate", protect, initiateUpload);
router.post("/part-urls", protect, getPartUrls);
router.post("/complete", protect, completeUpload);
router.post("/abort", protect, abortUpload);

// Public status and video retrieval
router.get("/:id/status", getVideoStatus);
router.get("/:id", getVideoById);

export default router;

