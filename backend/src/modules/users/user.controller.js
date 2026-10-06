import pool from "../../config/db.js";
import redis from "../../config/redis.js";
import { AppError } from "../../utils/AppError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// GET Profile (Uses Redis Cache from Day 13)
export const getUserProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    const cacheKey = `user:${username}`;

    // 1. Check Redis Cache
    const cachedUser = await redis.get(cacheKey);
    if (cachedUser) {
      return res.status(200).json(
        new ApiResponse(200, { source: "cache", user: JSON.parse(cachedUser) }, "Profile fetched from Cache")
      );
    }

    // 2. CACHE MISS. Query PostgreSQL
    // Notice we include following/followers counts using subqueries
    const query = `
      SELECT 
        u.id, u.username, u.email, u.bio, u.created_at,
        (SELECT COUNT(*) FROM follows WHERE follower_id = u.id) as following_count,
        (SELECT COUNT(*) FROM follows WHERE following_id = u.id) as followers_count
      FROM users u
      WHERE u.username = $1;
    `;
    const result = await pool.query(query, [username]);

    if (result.rowCount === 0) {
      throw new AppError(404, "User not found");
    }

    const user = result.rows[0];

    // 3. Save to Redis for next time (Expires in 5 minutes)
    await redis.set(cacheKey, JSON.stringify(user), "EX", 300);

    return res.status(200).json(
      new ApiResponse(200, { source: "database", user }, "Profile fetched from PostgreSQL")
    );
  } catch (error) {
    // If the 'follows' table doesn't exist yet, fallback to simple query
    if (error.code === '42P01') { 
      try {
        const query = `SELECT id, username, email, bio, created_at FROM users WHERE username = $1;`;
        const result = await pool.query(query, [req.params.username]);
        if (result.rowCount === 0) throw new AppError(404, "User not found");
        
        const user = { ...result.rows[0], following_count: 0, followers_count: 0 };
        return res.status(200).json(new ApiResponse(200, { source: "database", user }, "Profile fetched (fallback)"));
      } catch (fallbackError) {
        next(fallbackError);
      }
    } else {
      next(error);
    }
  }
};

// PUT Update Profile (Cache Invalidation from Day 14)
export const updateUserProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    const { bio } = req.body;
    
    // Ensure the user is only updating their own profile
    if (req.user.username !== username) {
      throw new AppError(403, "You can only update your own profile");
    }

    const cacheKey = `user:${username}`;

    // 1. Update the Source of Truth (Database)
    const updateQuery = `
      UPDATE users 
      SET bio = $1, updated_at = NOW() 
      WHERE username = $2 
      RETURNING id, username, email, bio, created_at;
    `;
    const result = await pool.query(updateQuery, [bio, username]);

    if (result.rowCount === 0) {
      throw new AppError(404, "User not found");
    }

    // 2. INVALIDATE THE CACHE! (Delete stale data)
    await redis.del(cacheKey);

    return res.status(200).json(
      new ApiResponse(200, { user: result.rows[0] }, "Profile updated successfully")
    );
  } catch (error) {
    next(error);
  }
};
