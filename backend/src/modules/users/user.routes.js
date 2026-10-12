import express from "express";
import { 
  getUserProfile, 
  updateUserProfile, 
  toggleFollow, 
  getSuggestedUsers,
  getFollowers,
  getFollowing,
  getNotifications,
  getUnreadCounts,
  deleteNotification,
  markNotificationsRead,
  getConversations,
  getMessagesWithUser,
  sendMessage
} from "./user.controller.js";
import { protect, optionalProtect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

// Specific routes (MUST precede /:username)
router.get("/suggestions", optionalProtect, getSuggestedUsers);

// Notifications routes
router.get("/notifications/unread-count", protect, getUnreadCounts);
router.get("/notifications", protect, getNotifications);
router.put("/notifications/read", protect, markNotificationsRead);
router.delete("/notifications/:id", protect, deleteNotification);

// Messages routes
router.get("/messages/conversations", protect, getConversations);
router.get("/messages/:username", protect, getMessagesWithUser);
router.post("/messages/:username", protect, sendMessage);

// User Profile routes
router.get("/:username", optionalProtect, getUserProfile);
router.get("/:username/followers", optionalProtect, getFollowers);
router.get("/:username/following", optionalProtect, getFollowing);
router.put("/:username", protect, updateUserProfile);
router.post("/:username/follow", protect, toggleFollow);

export default router;
