import pool from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

// ─── 1. Create Post ──────────────────────────────────────────────────────────
export const createPost = async (req, res, next) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      throw new AppError(400, "Post content cannot be empty");
    }

    if (content.trim().length > 500) {
      throw new AppError(400, "Post content cannot exceed 500 characters");
    }

    const insertQuery = `
      INSERT INTO posts (user_id, content)
      VALUES ($1, $2)
      RETURNING id, user_id, content, created_at, updated_at;
    `;
    const result = await pool.query(insertQuery, [userId, content.trim()]);
    const post = result.rows[0];

    // Fetch author info to return complete post object for immediate UI render
    const userQuery = `SELECT id, username, bio FROM users WHERE id = $1;`;
    const userResult = await pool.query(userQuery, [userId]);
    const author = userResult.rows[0];

    const fullPost = {
      ...post,
      author_id: author.id,
      username: author.username,
      author_bio: author.bio,
      likes_count: 0,
      has_liked: false,
    };

    return res
      .status(201)
      .json(new ApiResponse(201, { post: fullPost }, "Post created successfully"));
  } catch (error) {
    next(error);
  }
};

// ─── 2. Get Global Feed (Cursor-based Pagination) ───────────────────────────
export const getFeed = async (req, res, next) => {
  try {
    const cursor = req.query.cursor;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const currentUserId = req.user?.id || null;

    let query;
    let params;

    if (currentUserId) {
      if (cursor) {
        query = `
          SELECT 
            p.id,
            p.content,
            p.created_at,
            p.updated_at,
            u.id as author_id,
            u.username,
            u.bio as author_bio,
            (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
            EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked
          FROM posts p
          JOIN users u ON p.user_id = u.id
          WHERE p.created_at < $2
          ORDER BY p.created_at DESC
          LIMIT $3;
        `;
        params = [currentUserId, cursor, limit];
      } else {
        query = `
          SELECT 
            p.id,
            p.content,
            p.created_at,
            p.updated_at,
            u.id as author_id,
            u.username,
            u.bio as author_bio,
            (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
            EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked
          FROM posts p
          JOIN users u ON p.user_id = u.id
          ORDER BY p.created_at DESC
          LIMIT $2;
        `;
        params = [currentUserId, limit];
      }
    } else {
      if (cursor) {
        query = `
          SELECT 
            p.id,
            p.content,
            p.created_at,
            p.updated_at,
            u.id as author_id,
            u.username,
            u.bio as author_bio,
            (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
            false as has_liked
          FROM posts p
          JOIN users u ON p.user_id = u.id
          WHERE p.created_at < $1
          ORDER BY p.created_at DESC
          LIMIT $2;
        `;
        params = [cursor, limit];
      } else {
        query = `
          SELECT 
            p.id,
            p.content,
            p.created_at,
            p.updated_at,
            u.id as author_id,
            u.username,
            u.bio as author_bio,
            (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
            false as has_liked
          FROM posts p
          JOIN users u ON p.user_id = u.id
          ORDER BY p.created_at DESC
          LIMIT $1;
        `;
        params = [limit];
      }
    }

    const result = await pool.query(query, params);
    const posts = result.rows;

    let nextCursor = null;
    if (posts.length === limit) {
      nextCursor = posts[posts.length - 1].created_at;
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        { posts, nextCursor, count: posts.length },
        "Feed fetched successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

// ─── 3. Get Posts by Username (Profile Timeline) ─────────────────────────────
export const getUserPosts = async (req, res, next) => {
  try {
    const { username } = req.params;
    const cursor = req.query.cursor;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const currentUserId = req.user?.id || null;

    // Check user exists
    const userResult = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (userResult.rowCount === 0) {
      throw new AppError(404, "User not found");
    }
    const profileUserId = userResult.rows[0].id;

    let query;
    let params;

    if (currentUserId) {
      if (cursor) {
        query = `
          SELECT 
            p.id,
            p.content,
            p.created_at,
            p.updated_at,
            u.id as author_id,
            u.username,
            u.bio as author_bio,
            (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
            EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked
          FROM posts p
          JOIN users u ON p.user_id = u.id
          WHERE p.user_id = $2 AND p.created_at < $3
          ORDER BY p.created_at DESC
          LIMIT $4;
        `;
        params = [currentUserId, profileUserId, cursor, limit];
      } else {
        query = `
          SELECT 
            p.id,
            p.content,
            p.created_at,
            p.updated_at,
            u.id as author_id,
            u.username,
            u.bio as author_bio,
            (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
            EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked
          FROM posts p
          JOIN users u ON p.user_id = u.id
          WHERE p.user_id = $2
          ORDER BY p.created_at DESC
          LIMIT $3;
        `;
        params = [currentUserId, profileUserId, limit];
      }
    } else {
      if (cursor) {
        query = `
          SELECT 
            p.id,
            p.content,
            p.created_at,
            p.updated_at,
            u.id as author_id,
            u.username,
            u.bio as author_bio,
            (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
            false as has_liked
          FROM posts p
          JOIN users u ON p.user_id = u.id
          WHERE p.user_id = $1 AND p.created_at < $2
          ORDER BY p.created_at DESC
          LIMIT $3;
        `;
        params = [profileUserId, cursor, limit];
      } else {
        query = `
          SELECT 
            p.id,
            p.content,
            p.created_at,
            p.updated_at,
            u.id as author_id,
            u.username,
            u.bio as author_bio,
            (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
            false as has_liked
          FROM posts p
          JOIN users u ON p.user_id = u.id
          WHERE p.user_id = $1
          ORDER BY p.created_at DESC
          LIMIT $2;
        `;
        params = [profileUserId, limit];
      }
    }

    const result = await pool.query(query, params);
    const posts = result.rows;

    let nextCursor = null;
    if (posts.length === limit) {
      nextCursor = posts[posts.length - 1].created_at;
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        { posts, nextCursor, count: posts.length },
        "User posts fetched successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

// ─── 4. Get Single Post ──────────────────────────────────────────────────────
export const getPostById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id || null;

    let query;
    let params;

    if (currentUserId) {
      query = `
        SELECT 
          p.id,
          p.content,
          p.created_at,
          p.updated_at,
          u.id as author_id,
          u.username,
          u.bio as author_bio,
          (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
          EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = $2;
      `;
      params = [currentUserId, id];
    } else {
      query = `
        SELECT 
          p.id,
          p.content,
          p.created_at,
          p.updated_at,
          u.id as author_id,
          u.username,
          u.bio as author_bio,
          (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
          false as has_liked
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE p.id = $1;
      `;
      params = [id];
    }

    const result = await pool.query(query, params);
    if (result.rowCount === 0) {
      throw new AppError(404, "Post not found");
    }

    return res.status(200).json(
      new ApiResponse(200, { post: result.rows[0] }, "Post fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

// ─── 5. Update Post (Author Only) ────────────────────────────────────────────
export const updatePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      throw new AppError(400, "Post content cannot be empty");
    }

    if (content.trim().length > 500) {
      throw new AppError(400, "Post content cannot exceed 500 characters");
    }

    // Verify ownership
    const postCheck = await pool.query("SELECT user_id FROM posts WHERE id = $1", [id]);
    if (postCheck.rowCount === 0) {
      throw new AppError(404, "Post not found");
    }
    if (postCheck.rows[0].user_id !== userId) {
      throw new AppError(403, "Forbidden: You can only edit your own posts");
    }

    const updateQuery = `
      UPDATE posts
      SET content = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, user_id, content, created_at, updated_at;
    `;
    const result = await pool.query(updateQuery, [content.trim(), id]);
    const updatedPost = result.rows[0];

    return res.status(200).json(
      new ApiResponse(200, { post: updatedPost }, "Post updated successfully")
    );
  } catch (error) {
    next(error);
  }
};

// ─── 6. Delete Post (Author Only) ────────────────────────────────────────────
export const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const postCheck = await pool.query("SELECT user_id FROM posts WHERE id = $1", [id]);
    if (postCheck.rowCount === 0) {
      throw new AppError(404, "Post not found");
    }
    if (postCheck.rows[0].user_id !== userId) {
      throw new AppError(403, "Forbidden: You can only delete your own posts");
    }

    await pool.query("DELETE FROM posts WHERE id = $1", [id]);

    return res.status(200).json(
      new ApiResponse(200, { id }, "Post deleted successfully")
    );
  } catch (error) {
    next(error);
  }
};

// ─── 7. Toggle Like on Post ──────────────────────────────────────────────────
export const toggleLike = async (req, res, next) => {
  try {
    const { id } = req.params; // post id
    const userId = req.user.id;

    // Verify post exists
    const postCheck = await pool.query("SELECT id FROM posts WHERE id = $1", [id]);
    if (postCheck.rowCount === 0) {
      throw new AppError(404, "Post not found");
    }

    // Check if already liked
    const likeCheck = await pool.query(
      "SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2",
      [userId, id]
    );

    let liked = false;
    if (likeCheck.rowCount > 0) {
      // Unlike
      await pool.query("DELETE FROM likes WHERE user_id = $1 AND post_id = $2", [userId, id]);
      liked = false;
    } else {
      // Like
      await pool.query(
        "INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [userId, id]
      );
      liked = true;
    }

    // Get updated like count
    const countResult = await pool.query(
      "SELECT COUNT(*)::int as count FROM likes WHERE post_id = $1",
      [id]
    );
    const likesCount = countResult.rows[0].count;

    return res.status(200).json(
      new ApiResponse(200, { liked, likes_count: likesCount }, liked ? "Post liked" : "Post unliked")
    );
  } catch (error) {
    next(error);
  }
};
