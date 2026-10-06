import express from "express";
import { getUserProfile, updateUserProfile } from "./user.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/:username", getUserProfile);
router.put("/:username", protect, updateUserProfile);

export default router;
