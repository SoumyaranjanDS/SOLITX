import express from "express";
import {
  getCommunities,
  createCommunity,
  getCommunityBySlugOrId,
  getCommunityFeed,
  getCommunityMembers,
  toggleJoinCommunity,
  addCommunityMember
} from "./community.controller.js";
import { protect, optionalProtect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", optionalProtect, getCommunities);
router.post("/", protect, createCommunity);
router.get("/:slugOrId", optionalProtect, getCommunityBySlugOrId);
router.get("/:slugOrId/feed", optionalProtect, getCommunityFeed);
router.get("/:slugOrId/members", optionalProtect, getCommunityMembers);
router.post("/:id/join", protect, toggleJoinCommunity);
router.post("/:id/members", protect, addCommunityMember);

export default router;
