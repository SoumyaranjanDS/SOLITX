import express from "express";
import { searchAll } from "./search.controller.js";
import { optionalProtect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

// GET /api/v1/search?q=...&type=all|users|posts|communities|lists&limit=20
router.get("/", optionalProtect, searchAll);

export default router;

