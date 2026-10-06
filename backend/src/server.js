import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { ApiResponse } from "./utils/ApiResponse.js";
import { AppError } from "./utils/AppError.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 5005;

import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import pool from "./config/db.js";
import redis from "./config/redis.js";

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);

// TEMPORARY ENDPOINT FOR LOAD TESTING (DAY 8) & PAGINATION (DAY 10)
app.get("/api/v1/test/feed/:user_id", async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const cursor = req.query.cursor; // Timestamp from the last fetched post

    let query;
    let params;

    if (cursor) {
      query = `
        SELECT * FROM posts 
        WHERE user_id = $1 AND created_at < $2
        ORDER BY created_at DESC 
        LIMIT 20;
      `;
      params = [user_id, cursor];
    } else {
      query = `
        SELECT * FROM posts 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT 20;
      `;
      params = [user_id];
    }

    const result = await pool.query(query, params);

    // Determine the next cursor to pass to the frontend
    let nextCursor = null;
    if (result.rows.length === 20) {
      nextCursor = result.rows[result.rows.length - 1].created_at;
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { count: result.rowCount, nextCursor, data: result.rows },
          "Feed fetched successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
});

// DAY 13: REDIS CACHING (Repeated Reads)
app.get("/api/v1/test/user/:username", async (req, res, next) => {
  try {
    const { username } = req.params;
    const cacheKey = `user:${username}`;

    // 1. Check Redis Cache
    const cachedUser = await redis.get(cacheKey);
    if (cachedUser) {
      // CACHE HIT! Instant response.
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { source: "cache", user: JSON.parse(cachedUser) },
            "User fetched from Redis Cache",
          ),
        );
    }

    // 2. CACHE MISS. Query PostgreSQL
    const query = `SELECT id, username, email, bio, created_at FROM users WHERE username = $1;`;
    const result = await pool.query(query, [username]);

    if (result.rowCount === 0) {
      throw new AppError(404, "User not found");
    }

    const user = result.rows[0];

    // 3. Save to Redis for next time (Expires in 5 minutes)
    await redis.set(cacheKey, JSON.stringify(user), "EX", 300);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { source: "database", user },
          "User fetched from PostgreSQL",
        ),
      );
  } catch (error) {
    next(error);
  }
});

// DAY 14: CACHE INVALIDATION
app.put("/api/v1/test/user/:username", async (req, res, next) => {
  try {
    const { username } = req.params;
    const { bio } = req.body;
    const cacheKey = `user:${username}`;

    // 1. Update the Source of Truth (Database)
    const updateQuery = `UPDATE users SET bio = $1, updated_at = NOW() WHERE username = $2 RETURNING id, username, email, bio, created_at;`;
    const result = await pool.query(updateQuery, [bio, username]);

    if (result.rowCount === 0) {
      throw new AppError(404, "User not found");
    }

    // 2. INVALIDATE THE CACHE! (Delete stale data)
    await redis.del(cacheKey);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { user: result.rows[0] },
          "User updated and cache invalidated",
        ),
      );
  } catch (error) {
    next(error);
  }
});

app.get("/api/v1", async (req, res, next) => {
  try {
    return res
      .status(200)
      .json(new ApiResponse(200, { port }, "SOLITX API is running smoothly!"));
  } catch (error) {
    next(error); // Explicitly passing errors to the global error handler
  }
});

app.get("/error-test", async (req, res, next) => {
  try {
    throw new AppError(400, "This is a deliberate test error!");
  } catch (error) {
    next(error); // Explicitly passing errors to the global error handler
  }
});

app.use(errorHandler);

connectDB().then(() => {
  app.listen(port, () => console.log(`Server running on port ${port}`));
});
