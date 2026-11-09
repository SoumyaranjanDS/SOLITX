import { Router } from "express";
import { protect, optionalProtect } from "../../middlewares/authMiddleware.js";
import {
  initiateUpload,
  getPartUrls,
  completeUpload,
  abortUpload,
  getVideoStatus,
  getVideoById,
  recordVideoView,
} from "./video.controller.js";

const router = Router();

// Protected upload workflow
router.post("/initiate", protect, initiateUpload);
router.post("/part-urls", protect, getPartUrls);
router.post("/complete", protect, completeUpload);
router.post("/abort", protect, abortUpload);

// Public status, details and view analytics
router.get("/:id/status", getVideoStatus);
router.get("/:id", getVideoById);
router.post("/:id/view", optionalProtect, recordVideoView);

export default router;

