import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import pool from "../../config/db.js";
import redis from "../../config/redis.js";
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
    let { username, email, password } = req.body;

    if (!email || !password) {
      throw new AppError(400, "Please provide email and password");
    }

    // Auto-generate provisional username if not supplied
    if (!username || !username.trim()) {
      const emailPrefix =
        email
          .split("@")[0]
          .replace(/[^a-zA-Z0-9_]/g, "")
          .slice(0, 12)
          .toLowerCase() || "user";
      let candidate = `${emailPrefix}_${Math.floor(1000 + Math.random() * 9000)}`;
      let isUnique = false;
      while (!isUnique) {
        const check = await pool.query(
          "SELECT 1 FROM users WHERE username = $1",
          [candidate],
        );
        if (check.rowCount === 0) {
          isUnique = true;
          username = candidate;
        } else {
          candidate = `${emailPrefix}_${Math.floor(1000 + Math.random() * 9000)}`;
        }
      }
    } else {
      username = username.trim().toLowerCase();
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
      RETURNING id, username, email, name, bio, avatar_url, banner_url, created_at
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

    // Retrieve username before deleting so we can purge Redis cache
    const userRes = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [userId],
    );
    const username = userRes.rows[0]?.username;

    const deleteQuery = "DELETE FROM users WHERE id = $1 RETURNING id";
    const result = await pool.query(deleteQuery, [userId]);

    if (result.rows.length === 0) {
      throw new AppError(404, "User not found");
    }

    if (username) {
      try {
        await redis.del(`user:${username}`);
      } catch (e) {
        // Continue even if Redis fails
      }
    }

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "User account deleted successfully"));
  } catch (error) {
    next(error);
  }
};

export const googleAuthCallback = async (req, res, next) => {
  try {
    const profile = req.user;
    const email = profile.emails[0].value;
    const googleName = profile.displayName || null;
    const googleAvatar = profile.photos?.[0]?.value || null;

    const findUserQuery =
      "SELECT id, username, email, name, bio, bio_link, avatar_url, banner_url, created_at FROM users WHERE email = $1";
    let result = await pool.query(findUserQuery, [email]);

    const frontendUrl =
      process.env.FRONTEND_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://solitx.soumya.site"
        : "http://localhost:5173");

    if (result.rows.length === 0) {
      // New user registering via Google!
      // Generate a provisional unique username
      const rawBase =
        (profile.displayName || email.split("@")[0] || "user")
          .replace(/[^a-zA-Z0-9_]/g, "")
          .slice(0, 12)
          .toLowerCase() || "user";

      let candidate = `${rawBase}_${Math.floor(1000 + Math.random() * 9000)}`;
      let isUnique = false;
      while (!isUnique) {
        const check = await pool.query(
          "SELECT 1 FROM users WHERE username = $1",
          [candidate],
        );
        if (check.rowCount === 0) {
          isUnique = true;
        } else {
          candidate = `${rawBase}_${Math.floor(1000 + Math.random() * 9000)}`;
        }
      }

      // Generate random secure password hash for OAuth account
      const randomPassword =
        Math.random().toString(36).slice(-8) +
        Math.random().toString(36).slice(-8);
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(randomPassword, salt);

      const insertUserQuery = `
        INSERT INTO users (username, email, password_hash, name, avatar_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, username, email, name, bio, avatar_url, banner_url, created_at
      `;
      const newUser = await pool.query(insertUserQuery, [
        candidate,
        email,
        passwordHash,
        googleName,
        googleAvatar,
      ]);
      const user = newUser.rows[0];
      const token = generateToken(user.id);

      return res.redirect(
        `${frontendUrl}?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}&isNewUser=true`,
      );
    } else {
      // Existing user, log them in normally
      const user = result.rows[0];
      const token = generateToken(user.id);
      return res.redirect(
        `${frontendUrl}?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`,
      );
    }
  } catch (error) {
    next(error);
  }
};

export const checkUsername = async (req, res, next) => {
  try {
    const { username } = req.query;
    if (!username)
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Username required"));

    const result = await pool.query(
      "SELECT 1 FROM users WHERE username = $1 LIMIT 1",
      [username.toLowerCase()],
    );
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { available: result.rowCount === 0 },
          "Checked username",
        ),
      );
  } catch (error) {
    next(error);
  }
};

export const completeGoogleRegistration = async (req, res, next) => {
  try {
    const { tempToken, username } = req.body;
    if (!tempToken || !username) {
      throw new AppError(400, "Missing token or username");
    }

    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    const { email } = decoded;

    const checkUser = await pool.query(
      "SELECT 1 FROM users WHERE username = $1",
      [username.toLowerCase()],
    );
    if (checkUser.rowCount > 0)
      throw new AppError(400, "Username already taken");

    const checkEmail = await pool.query(
      "SELECT 1 FROM users WHERE email = $1",
      [email],
    );
    if (checkEmail.rowCount > 0)
      throw new AppError(400, "Email already registered");

    const randomPassword = Math.random().toString(36).slice(-8);
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(randomPassword, salt);

    const insertUserQuery = `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email, name, bio, avatar_url, banner_url, created_at
    `;
    const newUser = await pool.query(insertUserQuery, [
      username.toLowerCase(),
      email,
      passwordHash,
    ]);
    const user = newUser.rows[0];

    const token = generateToken(user.id);
    return res
      .status(201)
      .json(new ApiResponse(201, { user, token }, "Registered successfully"));
  } catch (error) {
    next(error);
  }
};
