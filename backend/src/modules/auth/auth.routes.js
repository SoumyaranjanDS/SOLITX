import express from "express";
import { registerUser, loginUser, logoutUser, deleteUser } from "./auth.controller.js";
import { protect } from "../../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", protect, logoutUser);
router.delete("/delete", protect, deleteUser);

export default router;
