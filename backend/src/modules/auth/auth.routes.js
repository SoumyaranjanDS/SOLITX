import express from "express";
import { registerUser, loginUser, logoutUser, deleteUser } from "./auth.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";
import { authLimiter } from "../../middlewares/rateLimiter.js";

import passport from "../../config/passport.js";
import { googleAuthCallback, checkUsername, completeGoogleRegistration } from "./auth.controller.js";

const router = express.Router();

// Apply authLimiter to prevent brute-force attacks on bcrypt
router.post("/register", authLimiter, registerUser);
router.post("/login", authLimiter, loginUser);
router.post("/logout", protect, logoutUser);
router.delete("/delete", protect, deleteUser);

// Google OAuth
router.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));
router.get("/google/callback", passport.authenticate("google", { session: false }), googleAuthCallback);
router.post("/google/complete", completeGoogleRegistration);

// Check availability
router.get("/check-username", checkUsername);

export default router;
