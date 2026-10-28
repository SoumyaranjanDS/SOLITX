import pool from "../../config/db.js";
import redis from "../../config/redis.js";
import { AppError } from "../../utils/AppError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { createNotification } from "../../services/notificationService.js";
import {
  emitNewMessage,
  isUserOnline,
  getOnlineUsernames,
} from "../../services/socketService.js";

// GET Profile (Uses Redis Cache from Day 13)
export const getUserProfile = async (req, res, next) => {
  try {
    const { username } = req.params;
    const cacheKey = `user:${username}`;

    // 1. Check Redis Cache (fail-safe)
    try {
      const cachedUser = await redis.get(cacheKey);
      if (cachedUser) {
        return res
          .status(200)
          .json(
            new ApiResponse(
              200,
              { source: "cache", user: JSON.parse(cachedUser) },
              "Profile fetched from Cache",
            ),
          );
      }
    } catch (cacheErr) {
      // If Redis times out or is down, gracefully fallback to DB
    }

    // 2. Query PostgreSQL with followers counts and is_following check
    const currentUserId = req.user?.id || null;
    let query;
    let params;

    if (currentUserId) {
      query = `
        SELECT 
          u.id, u.name, u.username, u.email, u.bio, u.bio_link, u.avatar_url, u.banner_url, u.created_at,
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
          u.id, u.name, u.username, u.email, u.bio, u.bio_link, u.avatar_url, u.banner_url, u.created_at,
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

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { source: "database", user },
          "Profile fetched from PostgreSQL",
        ),
      );
  } catch (error) {
    next(error);
  }
};

// PUT Update Profile (Cache Invalidation from Day 14)
export const updateUserProfile = async (req, res, next) => {
  try {
    const { username: paramUsername } = req.params;
    const { name, bio, bio_link, avatar_url, banner_url, newUsername } =
      req.body;

    // Ensure the user is only updating their own profile
    const currentUserId = req.user.id;
    const userCheck = await pool.query(
      "SELECT id, username, username_set FROM users WHERE id = $1",
      [currentUserId],
    );
    if (
      userCheck.rowCount === 0 ||
      userCheck.rows[0].username !== paramUsername
    ) {
      throw new AppError(403, "You can only update your own profile");
    }

    if (name && name.trim().length > 100) {
      throw new AppError(400, "Name cannot exceed 100 characters");
    }

    if (bio && bio.trim().length > 200) {
      throw new AppError(400, "Bio cannot exceed 200 characters");
    }

    if (bio_link && bio_link.trim().length > 255) {
      throw new AppError(400, "Bio link cannot exceed 255 characters");
    }

    let targetUsername = paramUsername;
    let markUsernameSet = userCheck.rows[0].username_set;

    if (
      newUsername &&
      newUsername.trim().toLowerCase() !== paramUsername.toLowerCase()
    ) {
      // Username is permanent after onboarding setup
      if (userCheck.rows[0].username_set) {
        throw new AppError(400, "Username is permanent and cannot be changed");
      }

      const cleanUsername = newUsername.trim().toLowerCase();
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
        throw new AppError(
          400,
          "Username must be 3-20 characters with letters, numbers, or underscores",
        );
      }
      const collision = await pool.query(
        "SELECT 1 FROM users WHERE username = $1 AND id != $2",
        [cleanUsername, currentUserId],
      );
      if (collision.rowCount > 0) {
        throw new AppError(400, "Username is already taken");
      }
      targetUsername = cleanUsername;
      markUsernameSet = true;
    }

    // Invalidate old cache (fail-safe)
    try {
      await redis.del(`user:${paramUsername}`);
    } catch (e) {}

    // Update DB
    const updateQuery = `
      UPDATE users 
      SET 
        name = COALESCE($1, name),
        bio = COALESCE($2, bio), 
        bio_link = COALESCE($3, bio_link),
        avatar_url = COALESCE($4, avatar_url),
        banner_url = COALESCE($5, banner_url),
        username = $6,
        username_set = $7,
        updated_at = NOW() 
      WHERE id = $8 
      RETURNING id, name, username, email, bio, bio_link, avatar_url, banner_url, created_at, updated_at;
    `;
    const result = await pool.query(updateQuery, [
      name !== undefined ? name.trim() : null,
      bio !== undefined ? bio.trim() : null,
      bio_link !== undefined ? bio_link.trim() : null,
      avatar_url !== undefined ? avatar_url.trim() : null,
      banner_url !== undefined ? banner_url.trim() : null,
      targetUsername,
      markUsernameSet,
      currentUserId,
    ]);

    if (result.rowCount === 0) {
      throw new AppError(404, "User not found");
    }

    // Invalidate new cache if changed (fail-safe)
    if (targetUsername !== paramUsername) {
      try {
        await redis.del(`user:${targetUsername}`);
      } catch (e) {}
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { user: result.rows[0] },
          "Profile updated successfully",
        ),
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

    const targetUser = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username],
    );
    if (targetUser.rowCount === 0) {
      throw new AppError(404, "User not found");
    }
    const targetUserId = targetUser.rows[0].id;

    if (currentUserId === targetUserId) {
      throw new AppError(400, "You cannot follow yourself");
    }

    const followCheck = await pool.query(
      "SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2",
      [currentUserId, targetUserId],
    );

    let isFollowing = false;
    if (followCheck.rowCount > 0) {
      await pool.query(
        "DELETE FROM follows WHERE follower_id = $1 AND following_id = $2",
        [currentUserId, targetUserId],
      );
      isFollowing = false;
    } else {
      await pool.query(
        "INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)",
        [currentUserId, targetUserId],
      );
      isFollowing = true;

      // In-app Notification to followed user
      await createNotification({
        recipientId: targetUserId,
        actorId: currentUserId,
        type: "follow",
      });
    }

    // Invalidate Redis cache for user (fail-safe)
    try {
      await redis.del(`user:${username}`);
    } catch (e) {}

    const countResult = await pool.query(
      "SELECT COUNT(*)::int as count FROM follows WHERE following_id = $1",
      [targetUserId],
    );
    const followersCount = countResult.rows[0].count;

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { isFollowing, followers_count: followersCount },
          isFollowing ? "Followed" : "Unfollowed",
        ),
      );
  } catch (error) {
    next(error);
  }
};

// GET Suggested Users / Member Search ("Who to follow" & Live Autocomplete)
export const getSuggestedUsers = async (req, res, next) => {
  try {
    const currentUserId = req.user?.id || null;
    const search = (req.query.q || req.query.search || "")
      .trim()
      .replace(/^@/, "");
    const limit = Math.min(parseInt(req.query.limit, 10) || 8, 20);

    let whereClauses = [];
    let params = [];
    let idx = 1;

    let userIdx = null;
    if (currentUserId) {
      whereClauses.push(`u.id != $${idx}`);
      params.push(currentUserId);
      userIdx = idx++;
    }

    if (search) {
      whereClauses.push(`(u.username ILIKE $${idx} OR u.name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereSql =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const isFollowingSql = currentUserId
      ? `EXISTS(SELECT 1 FROM follows WHERE follower_id = $${userIdx} AND following_id = u.id) as is_following`
      : `false as is_following`;

    let orderSql = "ORDER BY u.created_at DESC";
    if (search) {
      orderSql = `ORDER BY (CASE WHEN LOWER(u.username) LIKE LOWER($${idx - 1}) THEN 0 ELSE 1 END), u.username ASC`;
    }

    params.push(limit);
    const limitIdx = idx;

    const query = `
      SELECT 
        u.id, 
        u.username, 
        u.name,
        u.bio,
        ${isFollowingSql}
      FROM users u
      ${whereSql}
      ${orderSql}
      LIMIT $${limitIdx};
    `;

    const result = await pool.query(query, params);
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { users: result.rows },
          "Suggested users fetched successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};

// GET Followers of a user
export const getFollowers = async (req, res, next) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.id || null;

    const userResult = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username],
    );
    if (userResult.rowCount === 0) throw new AppError(404, "User not found");
    const targetUserId = userResult.rows[0].id;

    let query;
    let params;

    if (currentUserId) {
      query = `
        SELECT 
          u.id, u.name, u.username, u.bio,
          EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) as is_following
        FROM follows f
        JOIN users u ON f.follower_id = u.id
        WHERE f.following_id = $1
        ORDER BY f.created_at DESC;
      `;
      params = [targetUserId, currentUserId];
    } else {
      query = `
        SELECT u.id, u.name, u.username, u.bio, false as is_following
        FROM follows f
        JOIN users u ON f.follower_id = u.id
        WHERE f.following_id = $1
        ORDER BY f.created_at DESC;
      `;
      params = [targetUserId];
    }

    const result = await pool.query(query, params);
    return res
      .status(200)
      .json(new ApiResponse(200, { users: result.rows }, "Followers fetched"));
  } catch (error) {
    next(error);
  }
};

// GET Accounts followed by a user
export const getFollowing = async (req, res, next) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.id || null;

    const userResult = await pool.query(
      "SELECT id FROM users WHERE username = $1",
      [username],
    );
    if (userResult.rowCount === 0) throw new AppError(404, "User not found");
    const targetUserId = userResult.rows[0].id;

    let query;
    let params;

    if (currentUserId) {
      query = `
        SELECT 
          u.id, u.name, u.username, u.bio,
          EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = u.id) as is_following
        FROM follows f
        JOIN users u ON f.following_id = u.id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC;
      `;
      params = [targetUserId, currentUserId];
    } else {
      query = `
        SELECT u.id, u.name, u.username, u.bio, false as is_following
        FROM follows f
        JOIN users u ON f.following_id = u.id
        WHERE f.follower_id = $1
        ORDER BY f.created_at DESC;
      `;
      params = [targetUserId];
    }

    const result = await pool.query(query, params);
    return res
      .status(200)
      .json(new ApiResponse(200, { users: result.rows }, "Following fetched"));
  } catch (error) {
    next(error);
  }
};

// ─── GET User Notifications ──────────────────────────────────────────────────
export const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT 
        n.id,
        n.type,
        n.is_read,
        n.created_at,
        n.post_id,
        n.comment_id,
        n.message_content,
        u.username as actor_username,
        u.name as actor_name,
        p.content as post_content,
        c.content as comment_content
      FROM notifications n
      JOIN users u ON n.actor_id = u.id
      LEFT JOIN posts p ON n.post_id = p.id
      LEFT JOIN comments c ON n.comment_id = c.id
      WHERE n.recipient_id = $1
      ORDER BY n.created_at DESC
      LIMIT 60;
    `;
    const result = await pool.query(query, [userId]);
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { notifications: result.rows, count: result.rowCount },
          "Notifications fetched successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};

// ─── PUT Mark All Notifications Read ─────────────────────────────────────────
export const markNotificationsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    await pool.query(
      "UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1",
      [userId],
    );
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Notifications marked as read"));
  } catch (error) {
    next(error);
  }
};

// ─── GET DM Conversations ───────────────────────────────────────────────────
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const query = `
      SELECT DISTINCT ON (partner_id)
        partner_id,
        partner_username,
        partner_name,
        content as last_message,
        created_at as last_message_at
      FROM (
        SELECT 
          CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END as partner_id,
          CASE WHEN sender_id = $1 THEN ru.username ELSE su.username END as partner_username,
          CASE WHEN sender_id = $1 THEN ru.name ELSE su.name END as partner_name,
          content,
          m.created_at
        FROM messages m
        JOIN users su ON m.sender_id = su.id
        JOIN users ru ON m.recipient_id = ru.id
        WHERE m.sender_id = $1 OR m.recipient_id = $1
        ORDER BY m.created_at DESC
      ) t
      ORDER BY partner_id, last_message_at DESC;
    `;
    const result = await pool.query(query, [userId]);
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { conversations: result.rows },
          "Conversations fetched",
        ),
      );
  } catch (error) {
    next(error);
  }
};

// ─── GET Messages With User ─────────────────────────────────────────────────
export const getMessagesWithUser = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { username } = req.params;

    const userRes = await pool.query(
      "SELECT id, username, name FROM users WHERE username = $1",
      [username],
    );
    if (userRes.rowCount === 0) {
      throw new AppError(404, "User not found");
    }
    const partnerId = userRes.rows[0].id;

    const messagesRes = await pool.query(
      `
      SELECT 
        m.id,
        m.sender_id,
        m.recipient_id,
        m.content,
        m.created_at,
        (m.sender_id = $1) as is_mine
      FROM messages m
      WHERE (m.sender_id = $1 AND m.recipient_id = $2)
         OR (m.sender_id = $2 AND m.recipient_id = $1)
      ORDER BY m.created_at ASC
      LIMIT 100;
    `,
      [userId, partnerId],
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { partner: userRes.rows[0], messages: messagesRes.rows },
          "Messages fetched",
        ),
      );
  } catch (error) {
    next(error);
  }
};

// ─── POST Send Message ──────────────────────────────────────────────────────
export const sendMessage = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { username } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      throw new AppError(400, "Message content cannot be empty");
    }

    const userRes = await pool.query(
      "SELECT id, username, name FROM users WHERE username = $1",
      [username],
    );
    if (userRes.rowCount === 0) {
      throw new AppError(404, "Recipient not found");
    }
    const recipientId = userRes.rows[0].id;

    const insertRes = await pool.query(
      `
      INSERT INTO messages (sender_id, recipient_id, content)
      VALUES ($1, $2, $3)
      RETURNING id, sender_id, recipient_id, content, created_at;
    `,
      [userId, recipientId, content.trim()],
    );

    // Fetch sender info for real-time socket payload
    const senderRes = await pool.query(
      "SELECT id, username, name FROM users WHERE id = $1",
      [userId],
    );
    const sender = senderRes.rows[0];

    // In-app Notification for direct message
    await createNotification({
      recipientId,
      actorId: userId,
      type: "message",
      messageContent: content.trim(),
    });

    const fullMessage = {
      ...insertRes.rows[0],
      sender_username: sender?.username,
      sender_name: sender?.name,
      is_mine: false,
    };

    // Real-time live delivery via Socket.IO
    emitNewMessage(username, fullMessage);

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { message: { ...insertRes.rows[0], is_mine: true } },
          "Message sent",
        ),
      );
  } catch (error) {
    next(error);
  }
};

// ─── GET Unread Counts (Notifications & Messages) ───────────────────────────
export const getUnreadCounts = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(
      `
      SELECT 
        COUNT(*) FILTER (WHERE is_read = FALSE)::int as unread_notifications,
        COUNT(*) FILTER (WHERE type = 'message' AND is_read = FALSE)::int as unread_messages
      FROM notifications
      WHERE recipient_id = $1;
    `,
      [userId],
    );

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          result.rows[0] || { unread_notifications: 0, unread_messages: 0 },
          "Unread counts fetched successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};

// ─── DELETE Notification ─────────────────────────────────────────────────────
export const deleteNotification = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    await pool.query(
      "DELETE FROM notifications WHERE id = $1 AND recipient_id = $2",
      [id, userId],
    );
    return res
      .status(200)
      .json(new ApiResponse(200, null, "Notification deleted successfully"));
  } catch (error) {
    next(error);
  }
};

// ─── GET Online Status for Users ────────────────────────────────────────────
export const getUsersOnlineStatus = async (req, res, next) => {
  try {
    const { usernames } = req.query;
    if (!usernames) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { onlineUsers: getOnlineUsernames() },
            "Online users fetched successfully",
          ),
        );
    }

    const list = String(usernames)
      .split(",")
      .map((u) => u.trim().toLowerCase())
      .filter(Boolean);
    const statuses = {};
    list.forEach((u) => {
      statuses[u] = isUserOnline(u);
    });

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { statuses },
          "Online statuses fetched successfully",
        ),
      );
  } catch (error) {
    next(error);
  }
};
