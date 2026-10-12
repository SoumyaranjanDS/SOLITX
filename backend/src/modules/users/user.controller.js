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

    // 2. Query PostgreSQL with followers counts and is_following check
    const currentUserId = req.user?.id || null;
    let query;
    let params;

    if (currentUserId) {
      query = `
        SELECT 
          u.id, u.username, u.email, u.bio, u.created_at,
          (SELECT COUNT(*)::int FROM follows WHERE follower_id = u.id) as following_count,
          (SELECT COUNT(*)::int FROM follows WHERE following_id = u.id) as followers_count,
          EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) as is_following
        FROM users u
        WHERE u.username = $1;
      `;
      params = [username, currentUserId];
    } else {
      query = `
        SELECT 
          u.id, u.username, u.email, u.bio, u.created_at,
          (SELECT COUNT(*)::int FROM follows WHERE follower_id = u.id) as following_count,
          (SELECT COUNT(*)::int FROM follows WHERE following_id = u.id) as followers_count,
          false as is_following
        FROM users u
        WHERE u.username = $1;
      `;
      params = [username];
    }

    const result = await pool.query(query, params);

    if (result.rowCount === 0) {
      throw new AppError(404, "User not found");
    }

    const user = result.rows[0];

    return res.status(200).json(
      new ApiResponse(200, { source: "database", user }, "Profile fetched from PostgreSQL")
    );
  } catch (error) {
    next(error);
  }
};

// PUT Update Profile (Cache Invalidation from Day 14)
export const updateUserProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    const { bio } = req.body;
    
    // Ensure the user is only updating their own profile
    const currentUserId = req.user.id;
    const userCheck = await pool.query("SELECT id, username FROM users WHERE id = $1", [currentUserId]);
    if (userCheck.rowCount === 0 || userCheck.rows[0].username !== username) {
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

    // 2. Invalidate cache
    await redis.del(cacheKey);

    return res.status(200).json(
      new ApiResponse(200, { user: result.rows[0] }, "Profile updated successfully")
    );
  } catch (error) {
    next(error);
  }
};

// POST Toggle Follow
export const toggleFollow = async (req, res, next) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user.id;

    const targetUser = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (targetUser.rowCount === 0) {
      throw new AppError(404, "User not found");
    }
    const targetUserId = targetUser.rows[0].id;

    if (currentUserId === targetUserId) {
      throw new AppError(400, "You cannot follow yourself");
    }

    const followCheck = await pool.query(
      "SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2",
      [currentUserId, targetUserId]
    );

    let isFollowing = false;
    if (followCheck.rowCount > 0) {
      await pool.query("DELETE FROM follows WHERE follower_id = $1 AND following_id = $2", [currentUserId, targetUserId]);
      isFollowing = false;
    } else {
      await pool.query("INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)", [currentUserId, targetUserId]);
      isFollowing = true;
    }

    // Invalidate Redis cache for user
    await redis.del(`user:${username}`);

    const countResult = await pool.query(
      "SELECT COUNT(*)::int as count FROM follows WHERE following_id = $1",
      [targetUserId]
    );
    const followersCount = countResult.rows[0].count;

    return res.status(200).json(
      new ApiResponse(200, { isFollowing, followers_count: followersCount }, isFollowing ? "Followed" : "Unfollowed")
    );
  } catch (error) {
    next(error);
  }
};

// GET Suggested Users ("Who to follow")
export const getSuggestedUsers = async (req, res, next) => {
  try {
    const currentUserId = req.user?.id || null;
    let query;
    let params;

    if (currentUserId) {
      query = `
        SELECT 
          u.id, u.username, u.bio,
          EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following
        FROM users u
        WHERE u.id != $1
        ORDER BY u.created_at DESC
        LIMIT 5;
      `;
      params = [currentUserId];
    } else {
      query = `
        SELECT u.id, u.username, u.bio, false as is_following
        FROM users u
        ORDER BY u.created_at DESC
        LIMIT 5;
      `;
      params = [];
    }

    const result = await pool.query(query, params);
    return res.status(200).json(
      new ApiResponse(200, { users: result.rows }, "Suggested users fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};
