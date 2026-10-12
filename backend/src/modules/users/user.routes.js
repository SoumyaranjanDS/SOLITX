import express from "express";
import { 
  getUserProfile, 
  updateUserProfile, 
  toggleFollow, 
  getSuggestedUsers 
} from "./user.controller.js";
import { protect, optionalProtect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/suggestions", optionalProtect, getSuggestedUsers);
router.get("/:username", optionalProtect, getUserProfile);
router.put("/:username", protect, updateUserProfile);
router.post("/:username/follow", protect, toggleFollow);

export default router;
