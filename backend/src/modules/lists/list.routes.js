import express from "express";
import {
  getLists,
  createList,
  getListById,
  getListFeed,
  getListMembers,
  addListMember,
  removeListMember,
  toggleFollowList,
  togglePinList,
  deleteList
} from "./list.controller.js";
import { protect, optionalProtect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", optionalProtect, getLists);
router.post("/", protect, createList);
router.get("/:id", optionalProtect, getListById);
router.get("/:id/feed", optionalProtect, getListFeed);
router.get("/:id/members", optionalProtect, getListMembers);
router.post("/:id/members", protect, addListMember);
router.delete("/:id/members/:userId", protect, removeListMember);
router.post("/:id/follow", protect, toggleFollowList);
router.post("/:id/pin", protect, togglePinList);
router.delete("/:id", protect, deleteList);

export default router;
