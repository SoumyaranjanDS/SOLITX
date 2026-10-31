import pool from "../../config/db.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { AppError } from "../../utils/AppError.js";
import { createNotification } from "../../services/notificationService.js";
import { MEDIA_JSON_SELECT } from "../posts/post.controller.js";

// GET All Lists (Public + User's private lists)
export const getLists = async (req, res, next) => {
  try {
    const currentUserId = req.user?.id || null;
    const search = (req.query.q || req.query.search || "").trim();

    let searchFilter = "";
    const params = [currentUserId];

    if (search) {
      params.push(`%${search}%`);
      searchFilter = `AND (l.name ILIKE $2 OR l.description ILIKE $2 OR u.username ILIKE $2)`;
    }

    const query = `
      SELECT 
        l.id,
        l.name,
        l.description,
        l.is_private,
        l.created_at,
        u.username as creator_username,
        u.name as creator_name,
        COUNT(DISTINCT lm.user_id) as members_count,
        COUNT(DISTINCT lf.user_id) as followers_count,
        COALESCE(bool_or(lf.user_id = $1), false) as is_following,
        COALESCE(bool_or(lf.user_id = $1 AND lf.is_pinned = true), false) as is_pinned,
        (l.creator_id = $1) as is_creator
      FROM lists l
      JOIN users u ON l.creator_id = u.id
      LEFT JOIN list_members lm ON l.id = lm.list_id
      LEFT JOIN list_followers lf ON l.id = lf.list_id
      WHERE (l.is_private = false OR l.creator_id = $1)
      ${searchFilter}
      GROUP BY l.id, u.username, u.name
      ORDER BY l.created_at DESC;
    `;

    const result = await pool.query(query, params);
    return res.status(200).json(
      new ApiResponse(200, { lists: result.rows }, "Lists fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

// POST Create List
export const createList = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { name, description = "", is_private = false } = req.body;

    if (!name || !name.trim()) {
      throw new AppError(400, "List name is required");
    }

    const query = `
      INSERT INTO lists (creator_id, name, description, is_private)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;

    const result = await pool.query(query, [
      currentUserId,
      name.trim(),
      description ? description.trim() : "",
      Boolean(is_private)
    ]);

    const createdList = result.rows[0];

    // Automatically follow own list
    await pool.query(
      `INSERT INTO list_followers (list_id, user_id, is_pinned) VALUES ($1, $2, false) ON CONFLICT DO NOTHING`,
      [createdList.id, currentUserId]
    );

    return res.status(201).json(
      new ApiResponse(201, { list: createdList }, "List created successfully")
    );
  } catch (error) {
    next(error);
  }
};

// POST Toggle Follow List
export const toggleFollowList = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { id: listId } = req.params;

    const check = await pool.query(
      `SELECT 1 FROM list_followers WHERE list_id = $1 AND user_id = $2`,
      [listId, currentUserId]
    );

    let isFollowing = false;
    if (check.rowCount > 0) {
      await pool.query(
        `DELETE FROM list_followers WHERE list_id = $1 AND user_id = $2`,
        [listId, currentUserId]
      );
      isFollowing = false;
    } else {
      await pool.query(
        `INSERT INTO list_followers (list_id, user_id, is_pinned) VALUES ($1, $2, false)`,
        [listId, currentUserId]
      );
      isFollowing = true;
    }

    const countRes = await pool.query(
      `SELECT count(*) FROM list_followers WHERE list_id = $1`,
      [listId]
    );

    return res.status(200).json(
      new ApiResponse(200, {
        isFollowing,
        followersCount: parseInt(countRes.rows[0].count, 10)
      }, isFollowing ? "List followed" : "List unfollowed")
    );
  } catch (error) {
    next(error);
  }
};

// POST Toggle Pin List
export const togglePinList = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { id: listId } = req.params;

    const check = await pool.query(
      `SELECT is_pinned FROM list_followers WHERE list_id = $1 AND user_id = $2`,
      [listId, currentUserId]
    );

    let isPinned = false;
    if (check.rowCount > 0) {
      isPinned = !check.rows[0].is_pinned;
      await pool.query(
        `UPDATE list_followers SET is_pinned = $1 WHERE list_id = $2 AND user_id = $3`,
        [isPinned, listId, currentUserId]
      );
    } else {
      isPinned = true;
      await pool.query(
        `INSERT INTO list_followers (list_id, user_id, is_pinned) VALUES ($1, $2, true)`,
        [listId, currentUserId]
      );
    }

    return res.status(200).json(
      new ApiResponse(200, { isPinned }, isPinned ? "List pinned" : "List unpinned")
    );
  } catch (error) {
    next(error);
  }
};

// DELETE List
export const deleteList = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { id: listId } = req.params;

    const result = await pool.query(
      `DELETE FROM lists WHERE id = $1 AND creator_id = $2 RETURNING id`,
      [listId, currentUserId]
    );

    if (result.rowCount === 0) {
      throw new AppError(404, "List not found or you are not authorized to delete it");
    }

    return res.status(200).json(
      new ApiResponse(200, { id: listId }, "List deleted successfully")
    );
  } catch (error) {
    next(error);
  }
};

// GET List Details
export const getListById = async (req, res, next) => {
  try {
    const currentUserId = req.user?.id || null;
    const { id } = req.params;

    const query = `
      SELECT 
        l.id,
        l.name,
        l.description,
        l.is_private,
        l.created_at,
        u.id as creator_id,
        u.username as creator_username,
        u.name as creator_name,
        COUNT(DISTINCT lm.user_id) as members_count,
        COUNT(DISTINCT lf.user_id) as followers_count,
        COALESCE(bool_or(lf.user_id = $2), false) as is_following,
        COALESCE(bool_or(lf.user_id = $2 AND lf.is_pinned = true), false) as is_pinned,
        (l.creator_id = $2) as is_creator
      FROM lists l
      JOIN users u ON l.creator_id = u.id
      LEFT JOIN list_members lm ON l.id = lm.list_id
      LEFT JOIN list_followers lf ON l.id = lf.list_id
      WHERE l.id = $1
      GROUP BY l.id, u.id, u.username, u.name;
    `;

    const result = await pool.query(query, [id, currentUserId]);
    if (result.rowCount === 0) {
      throw new AppError(404, "List not found");
    }

    const list = result.rows[0];
    if (list.is_private && !list.is_creator) {
      throw new AppError(403, "This list is private");
    }

    return res.status(200).json(
      new ApiResponse(200, { list }, "List details fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

// GET List Feed (Posts by list members and creator)
export const getListFeed = async (req, res, next) => {
  try {
    const currentUserId = req.user?.id || null;
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    const listCheck = await pool.query("SELECT is_private, creator_id FROM lists WHERE id = $1", [id]);
    if (listCheck.rowCount === 0) {
      throw new AppError(404, "List not found");
    }
    if (listCheck.rows[0].is_private && listCheck.rows[0].creator_id !== currentUserId) {
      throw new AppError(403, "This list is private");
    }

    const selectLiked = currentUserId
      ? `EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $2) as has_liked`
      : 'false as has_liked';
    const selectBookmarked = currentUserId
      ? `EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = $2) as has_bookmarked`
      : 'false as has_bookmarked';
    const limitPlaceholder = currentUserId ? '$3' : '$2';

    const feedQuery = `
      SELECT 
        p.id,
        p.content,
        p.category,
        p.community_id,
        p.has_media,
        comm.name as community_name,
        comm.slug as community_slug,
        p.created_at,
        p.updated_at,
        COALESCE(p.views_count, 0) as views_count,
        u.id as author_id,
        u.name as author_name,
        u.username,
        u.bio as author_bio,
        u.avatar_url as author_avatar_url,
        (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
        (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) as replies_count,
        ${selectLiked},
        ${selectBookmarked},
        ${MEDIA_JSON_SELECT}
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN communities comm ON p.community_id = comm.id
      WHERE p.user_id IN (
        SELECT user_id FROM list_members WHERE list_id = $1
        UNION
        SELECT creator_id FROM lists WHERE id = $1
      )
      ORDER BY p.created_at DESC
      LIMIT ${limitPlaceholder};
    `;

    const params = currentUserId ? [id, currentUserId, limit] : [id, limit];
    const result = await pool.query(feedQuery, params);

    return res.status(200).json(
      new ApiResponse(200, { posts: result.rows }, "List feed fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

// GET List Members
export const getListMembers = async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.id || null;

    const listCheck = await pool.query("SELECT is_private, creator_id FROM lists WHERE id = $1", [id]);
    if (listCheck.rowCount === 0) {
      throw new AppError(404, "List not found");
    }
    if (listCheck.rows[0].is_private && listCheck.rows[0].creator_id !== currentUserId) {
      throw new AppError(403, "This list is private");
    }

    const query = `
      SELECT 
        u.id, 
        u.username, 
        u.name, 
        u.bio, 
        lm.created_at as joined_at,
        (u.id = $2) as is_self
      FROM list_members lm
      JOIN users u ON lm.user_id = u.id
      WHERE lm.list_id = $1
      ORDER BY lm.created_at DESC;
    `;

    const result = await pool.query(query, [id, currentUserId]);
    return res.status(200).json(
      new ApiResponse(200, { members: result.rows }, "List members fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

// POST Add Member to List
export const addListMember = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { id } = req.params;
    const { username } = req.body;

    if (!username || !username.trim()) {
      throw new AppError(400, "Username is required to add member");
    }

    const listCheck = await pool.query("SELECT name, creator_id FROM lists WHERE id = $1", [id]);
    if (listCheck.rowCount === 0) {
      throw new AppError(404, "List not found");
    }
    if (listCheck.rows[0].creator_id !== currentUserId) {
      throw new AppError(403, "Only the list creator can manage list members");
    }
    const list = listCheck.rows[0];

    const cleanUsername = username.trim().replace(/^@/, '');
    const userRes = await pool.query("SELECT id, username, name, bio FROM users WHERE LOWER(username) = LOWER($1)", [cleanUsername]);
    if (userRes.rowCount === 0) {
      throw new AppError(404, `User @${cleanUsername} not found`);
    }
    const targetUser = userRes.rows[0];

    await pool.query(
      `INSERT INTO list_members (list_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, targetUser.id]
    );

    // NOTIFY target user:
    await createNotification({
      recipientId: targetUser.id,
      actorId: currentUserId,
      type: "list_member_added",
      messageContent: list.name
    });

    const countRes = await pool.query("SELECT COUNT(*) FROM list_members WHERE list_id = $1", [id]);

    return res.status(200).json(
      new ApiResponse(200, {
        member: targetUser,
        membersCount: parseInt(countRes.rows[0].count, 10)
      }, `Added @${targetUser.username} to list`)
    );
  } catch (error) {
    next(error);
  }
};

// DELETE Remove Member from List
export const removeListMember = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { id, userId } = req.params;

    const listCheck = await pool.query("SELECT creator_id FROM lists WHERE id = $1", [id]);
    if (listCheck.rowCount === 0) {
      throw new AppError(404, "List not found");
    }
    if (listCheck.rows[0].creator_id !== currentUserId) {
      throw new AppError(403, "Only the list creator can manage list members");
    }

    await pool.query("DELETE FROM list_members WHERE list_id = $1 AND user_id = $2", [id, userId]);
    const countRes = await pool.query("SELECT COUNT(*) FROM list_members WHERE list_id = $1", [id]);

    return res.status(200).json(
      new ApiResponse(200, {
        membersCount: parseInt(countRes.rows[0].count, 10)
      }, "Member removed from list")
    );
  } catch (error) {
    next(error);
  }
};
