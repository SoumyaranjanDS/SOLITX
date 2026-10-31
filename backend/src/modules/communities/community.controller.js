import pool from "../../config/db.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { AppError } from "../../utils/AppError.js";
import { createNotification } from "../../services/notificationService.js";
import { MEDIA_JSON_SELECT } from "../posts/post.controller.js";

// GET All Communities
export const getCommunities = async (req, res, next) => {
  try {
    const currentUserId = req.user?.id || null;
    const search = (req.query.q || req.query.search || "").trim();

    let whereClause = "";
    const params = [currentUserId];

    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE (c.name ILIKE $2 OR c.description ILIKE $2 OR c.slug ILIKE $2 OR u.username ILIKE $2)`;
    }

    const query = `
      SELECT 
        c.id,
        c.name,
        c.slug,
        c.description,
        c.banner_gradient,
        c.created_at,
        u.username as creator_username,
        u.name as creator_name,
        COUNT(DISTINCT cm.user_id) as members_count,
        COALESCE(bool_or(cm.user_id = $1), false) as is_joined,
        (c.creator_id = $1) as is_creator
      FROM communities c
      JOIN users u ON c.creator_id = u.id
      LEFT JOIN community_members cm ON c.id = cm.community_id
      ${whereClause}
      GROUP BY c.id, u.username, u.name
      ORDER BY members_count DESC, c.created_at DESC;
    `;

    const result = await pool.query(query, params);
    return res.status(200).json(
      new ApiResponse(200, { communities: result.rows }, "Communities fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

// POST Create Community
export const createCommunity = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    let { name, slug, description = "", banner_gradient } = req.body;

    if (!name || !name.trim()) {
      throw new AppError(400, "Community name is required");
    }

    if (!slug || !slug.trim()) {
      slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    } else {
      slug = slug.toLowerCase().trim().replace(/[^a-z0-9_-]/g, "");
    }

    if (slug.length < 2) {
      throw new AppError(400, "Community slug must be at least 2 alphanumeric characters");
    }

    // Check slug uniqueness
    const slugCheck = await pool.query("SELECT 1 FROM communities WHERE slug = $1", [slug]);
    if (slugCheck.rowCount > 0) {
      throw new AppError(409, "Community slug or handle already taken");
    }

    const defaultGradient = banner_gradient || "from-purple-600 to-indigo-800";

    const insertQuery = `
      INSERT INTO communities (creator_id, name, slug, description, banner_gradient)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;

    const result = await pool.query(insertQuery, [
      currentUserId,
      name.trim(),
      slug,
      description ? description.trim() : "",
      defaultGradient
    ]);

    const community = result.rows[0];

    // Creator joins as admin
    await pool.query(
      `INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [community.id, currentUserId]
    );

    return res.status(201).json(
      new ApiResponse(201, { community }, "Community created successfully")
    );
  } catch (error) {
    next(error);
  }
};

// POST Toggle Join Community
export const toggleJoinCommunity = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { id: communityId } = req.params;

    const check = await pool.query(
      "SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2",
      [communityId, currentUserId]
    );

    let isJoined = false;
    if (check.rowCount > 0) {
      await pool.query(
        "DELETE FROM community_members WHERE community_id = $1 AND user_id = $2",
        [communityId, currentUserId]
      );
      isJoined = false;
    } else {
      await pool.query(
        "INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'member')",
        [communityId, currentUserId]
      );
      isJoined = true;

      // NOTIFY community creator:
      const commData = await pool.query("SELECT creator_id, name FROM communities WHERE id = $1", [communityId]);
      if (commData.rowCount > 0 && commData.rows[0].creator_id !== currentUserId) {
        await createNotification({
          recipientId: commData.rows[0].creator_id,
          actorId: currentUserId,
          type: "community_joined",
          messageContent: commData.rows[0].name
        });
      }
    }

    const countRes = await pool.query(
      "SELECT count(*) FROM community_members WHERE community_id = $1",
      [communityId]
    );

    return res.status(200).json(
      new ApiResponse(200, {
        isJoined,
        membersCount: parseInt(countRes.rows[0].count, 10)
      }, isJoined ? "Joined community" : "Left community")
    );
  } catch (error) {
    next(error);
  }
};

// POST Add Member to Community (by admin / creator)
export const addCommunityMember = async (req, res, next) => {
  try {
    const currentUserId = req.user.id;
    const { id: communityId } = req.params;
    const { username } = req.body;

    if (!username || !username.trim()) {
      throw new AppError(400, "Username is required");
    }

    const commCheck = await pool.query("SELECT id, name, creator_id FROM communities WHERE id::text = $1 OR slug = $1", [communityId]);
    if (commCheck.rowCount === 0) {
      throw new AppError(404, "Community not found");
    }
    const community = commCheck.rows[0];

    const cleanUsername = username.trim().replace(/^@/, '');
    const userRes = await pool.query("SELECT id, username, name, bio FROM users WHERE LOWER(username) = LOWER($1)", [cleanUsername]);
    if (userRes.rowCount === 0) {
      throw new AppError(404, `User @${cleanUsername} not found`);
    }
    const targetUser = userRes.rows[0];

    await pool.query(
      "INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING",
      [community.id, targetUser.id]
    );

    // Notify added user:
    await createNotification({
      recipientId: targetUser.id,
      actorId: currentUserId,
      type: "community_member_added",
      messageContent: community.name
    });

    const countRes = await pool.query("SELECT count(*) FROM community_members WHERE community_id = $1", [community.id]);

    return res.status(200).json(
      new ApiResponse(200, {
        member: targetUser,
        membersCount: parseInt(countRes.rows[0].count, 10)
      }, `Added @${targetUser.username} to community`)
    );
  } catch (error) {
    next(error);
  }
};

// GET Single Community by Slug or ID
export const getCommunityBySlugOrId = async (req, res, next) => {
  try {
    const currentUserId = req.user?.id || null;
    const { slugOrId } = req.params;

    const query = `
      SELECT 
        c.id,
        c.name,
        c.slug,
        c.description,
        c.banner_gradient,
        c.created_at,
        u.id as creator_id,
        u.username as creator_username,
        u.name as creator_name,
        COUNT(DISTINCT cm.user_id) as members_count,
        (SELECT COUNT(*)::int FROM posts p WHERE p.community_id = c.id) as posts_count,
        COALESCE(bool_or(cm.user_id = $2), false) as is_joined,
        (c.creator_id = $2) as is_creator,
        MAX(CASE WHEN cm.user_id = $2 THEN cm.role ELSE NULL END) as user_role
      FROM communities c
      JOIN users u ON c.creator_id = u.id
      LEFT JOIN community_members cm ON c.id = cm.community_id
      WHERE c.slug = $1 OR c.id::text = $1
      GROUP BY c.id, u.id, u.username, u.name;
    `;

    const result = await pool.query(query, [slugOrId, currentUserId]);
    if (result.rowCount === 0) {
      throw new AppError(404, "Community not found");
    }

    return res.status(200).json(
      new ApiResponse(200, { community: result.rows[0] }, "Community details fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

// GET Community Feed
export const getCommunityFeed = async (req, res, next) => {
  try {
    const currentUserId = req.user?.id || null;
    const { slugOrId } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    // Resolve community ID
    const commCheck = await pool.query(
      "SELECT id FROM communities WHERE slug = $1 OR id::text = $1",
      [slugOrId]
    );
    if (commCheck.rowCount === 0) {
      throw new AppError(404, "Community not found");
    }
    const communityId = commCheck.rows[0].id;

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
        c.name as community_name,
        c.slug as community_slug,
        p.created_at,
        p.updated_at,
        COALESCE(p.views_count, 0) as views_count,
        u.id as author_id,
        u.name as author_name,
        u.username,
        u.bio as author_bio,
        u.avatar_url as author_avatar_url,
        (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
        (SELECT COUNT(*)::int FROM comments c2 WHERE c2.post_id = p.id) as replies_count,
        ${selectLiked},
        ${selectBookmarked},
        ${MEDIA_JSON_SELECT}
      FROM posts p
      JOIN users u ON p.user_id = u.id
      JOIN communities c ON p.community_id = c.id
      WHERE p.community_id = $1
      ORDER BY p.created_at DESC
      LIMIT ${limitPlaceholder};
    `;

    const params = currentUserId ? [communityId, currentUserId, limit] : [communityId, limit];
    const result = await pool.query(feedQuery, params);

    return res.status(200).json(
      new ApiResponse(200, { posts: result.rows }, "Community feed fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

// GET Community Members
export const getCommunityMembers = async (req, res, next) => {
  try {
    const { slugOrId } = req.params;
    const currentUserId = req.user?.id || null;

    const commCheck = await pool.query(
      "SELECT id FROM communities WHERE slug = $1 OR id::text = $1",
      [slugOrId]
    );
    if (commCheck.rowCount === 0) {
      throw new AppError(404, "Community not found");
    }
    const communityId = commCheck.rows[0].id;

    const query = `
      SELECT 
        u.id, 
        u.username, 
        u.name, 
        u.bio, 
        cm.role,
        cm.created_at as joined_at,
        (u.id = $2) as is_self
      FROM community_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.community_id = $1
      ORDER BY (CASE WHEN cm.role = 'admin' THEN 0 ELSE 1 END), cm.created_at DESC;
    `;

    const result = await pool.query(query, [communityId, currentUserId]);
    return res.status(200).json(
      new ApiResponse(200, { members: result.rows }, "Community members fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};
