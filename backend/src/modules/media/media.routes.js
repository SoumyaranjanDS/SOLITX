import { Router } from "express";
import { protect } from "../../middlewares/authMiddleware.js";
import { 
  requestUploadUrl, 
  confirmUpload, 
  getMediaStatus 
} from "./media.controller.js";

const router = Router();

// Protected: Only authenticated users can generate upload URLs & confirm uploads
router.post("/upload-url", protect, requestUploadUrl);
router.post("/confirm", protect, confirmUpload);

// Public / Protected: Anyone can check the public media status/urls
router.get("/:id", getMediaStatus);

export default router;
