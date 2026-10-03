import express from "express";
import { registerUser, loginUser, logoutUser, deleteUser } from "./auth.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";
import { authLimiter } from "../../middlewares/rateLimiter.js";

const router = express.Router();

// Apply authLimiter to prevent brute-force attacks on bcrypt
router.post("/register", authLimiter, registerUser);
router.post("/login", authLimiter, loginUser);
router.post("/logout", protect, logoutUser);
router.delete("/delete", protect, deleteUser);

export default router;
