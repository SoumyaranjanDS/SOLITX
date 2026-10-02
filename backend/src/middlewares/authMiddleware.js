import jwt from "jsonwebtoken";
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
    
    // Attach user id to request object
    req.user = { id: decoded.id };
    
    next();
  } catch (error) {
    next(new AppError(401, "Not authorized, token failed"));
  }
};
