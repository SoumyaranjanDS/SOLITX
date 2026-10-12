import jwt from "jsonwebtoken";
import pool from "../config/db.js";
import { AppError } from "../utils/AppError.js";

export const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw new AppError(401, "Not authorized, no token provided");
    }

    const secret = process.env.JWT_SECRET || "solitx_development_secret_key";
    
    // Verify token
    const decoded = jwt.verify(token, secret);
    
    // Validate that user exists in database
    const userRes = await pool.query("SELECT id FROM users WHERE id = $1", [decoded.id]);
    if (userRes.rowCount === 0) {
      throw new AppError(401, "User session expired or user no longer exists");
    }

    // Attach user id to request object
    req.user = { id: decoded.id };
    
    next();
  } catch (error) {
    next(new AppError(401, error.message || "Not authorized, token failed"));
  }
};

export const optionalProtect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (token) {
      const secret = process.env.JWT_SECRET || "solitx_development_secret_key";
      const decoded = jwt.verify(token, secret);
      const userRes = await pool.query("SELECT id FROM users WHERE id = $1", [decoded.id]);
      if (userRes.rowCount > 0) {
        req.user = { id: decoded.id };
      } else {
        req.user = null;
      }
    }
  } catch (err) {
    // Silently continue as unauthenticated guest
    req.user = null;
  }
  next();
};
