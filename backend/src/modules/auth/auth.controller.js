import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pool from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

const generateToken = (userId) => {
  // In production, JWT_SECRET must be set in .env
  const secret = process.env.JWT_SECRET;
  return jwt.sign({ id: userId }, secret, {
    expiresIn: "7d",
  });
};

export const registerUser = async (req, res, next) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      throw new AppError(400, "Please provide username, email, and password");
    }

    // 1. Check if user already exists
    const userExistsQuery =
      "SELECT id FROM users WHERE email = $1 OR username = $2";
    const existingUser = await pool.query(userExistsQuery, [email, username]);

    if (existingUser.rows.length > 0) {
      throw new AppError(
        400,
        "User with that email or username already exists",
      );
    }

    // 2. Hash the password (never store plain text!)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 3. Insert user into database
    const insertUserQuery = `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email, bio, created_at
    `;
    const newUser = await pool.query(insertUserQuery, [
      username,
      email,
      passwordHash,
    ]);
    const user = newUser.rows[0];

    // 4. Generate stateless JWT token
    const token = generateToken(user.id);

    return res
      .status(201)
      .json(
        new ApiResponse(201, { user, token }, "User registered successfully"),
      );
  } catch (error) {
    next(error); // Passes error to the global errorHandler
  }
};

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new AppError(400, "Please provide email and password");
    }

    // 1. Find user by email
    const findUserQuery = "SELECT * FROM users WHERE email = $1";
    const result = await pool.query(findUserQuery, [email]);

    if (result.rows.length === 0) {
      throw new AppError(401, "Invalid email or password"); // Don't reveal which one is wrong
    }

    const user = result.rows[0];

    // 2. Compare passwords using bcrypt
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      throw new AppError(401, "Invalid email or password");
    }

    // 3. Generate Token
    const token = generateToken(user.id);

    // 4. Remove sensitive password hash before sending to client
    delete user.password_hash;

    return res
      .status(200)
      .json(new ApiResponse(200, { user, token }, "Login successful"));
  } catch (error) {
    next(error);
  }
};

export const logoutUser = async (req, res, next) => {
  try {
    // Since we use stateless JWTs, we just tell the client to discard the token.
    // If we used HTTP-only cookies, we would clear the cookie here.
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Logged out successfully"));
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const userId = req.user.id; // Comes from the protect middleware

    const deleteQuery = "DELETE FROM users WHERE id = $1 RETURNING id";
    const result = await pool.query(deleteQuery, [userId]);

    if (result.rows.length === 0) {
      throw new AppError(404, "User not found");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "User account deleted successfully"));
  } catch (error) {
    next(error);
  }
};
