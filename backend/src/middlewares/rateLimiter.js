import rateLimit from "express-rate-limit";
import { AppError } from "../utils/AppError.js";

// Limit repeated requests to public APIs like login/register
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next) => {
    next(
      new AppError(
        429,
        "Too many login/register attempts from this IP, please try again after 15 minutes",
      ),
    );
  },
});

// A slightly more generous limit for general API routes to prevent spam
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per `window`
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      new AppError(
        429,
        "Too many requests from this IP, please try again later",
      ),
    );
  },
});
