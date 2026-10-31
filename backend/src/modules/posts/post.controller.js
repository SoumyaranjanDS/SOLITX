import pool from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { createNotification } from "../../services/notificationService.js";
import { getMediaBaseUrl } from "../../services/s3Service.js";

const mediaBaseUrl = getMediaBaseUrl();

export const MEDIA_JSON_SELECT = `
  (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', m.id,
          'url_thumb', COALESCE(m.url_thumb, '${mediaBaseUrl}' || m.s3_key_raw),
          'url_feed', COALESCE(m.url_feed, '${mediaBaseUrl}' || m.s3_key_raw),
          'url_full', COALESCE(m.url_full, '${mediaBaseUrl}' || m.s3_key_raw),
          'url_raw', '${mediaBaseUrl}' || m.s3_key_raw,
          's3_key_raw', m.s3_key_raw,
          'width', m.width,
          'height', m.height,
          'status', m.status
        ) ORDER BY m.created_at ASC
      ), '[]'::json
    )
    FROM media m
    WHERE m.post_id = p.id
  ) as media
`;

// ─── 1. Create Post ──────────────────────────────────────────────────────────
export const createPost = async (req, res, next) => {
  try {
    const { content, category: reqCategory, community_id, media_ids } = req.body;
    const userId = req.user.id;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      throw new AppError(400, "Post content cannot be empty");
    }

    if (content.trim().length > 500) {
      throw new AppError(400, "Post content cannot exceed 500 characters");
    }

    // Auto-detect topic category from text & hashtags if not explicitly provided
    let category = (reqCategory || '').trim();
    if (!category || category === 'General') {
      const lower = content.toLowerCase();
      if (/#(tech|ai|ml|python|javascript|coding|code|webdev|software|dev|developer|react|vue|node|nextjs|postgres|database)\b/i.test(lower)) {
        category = 'Tech & AI';
      } else if (/#(business|startup|finance|crypto|money|economy|stocks|founder|vc|market)\b/i.test(lower)) {
        category = 'Business';
      } else if (/#(sports|football|cricket|nba|f1|soccer|fifa|tennis|athletics)\b/i.test(lower)) {
        category = 'Sports';
      } else if (/#(news|breaking|politics|world|currentaffairs|report)\b/i.test(lower)) {
        category = 'News';
      } else if (/#(entertainment|movie|movies|music|gaming|game|anime|hollywood|bollywood|tv)\b/i.test(lower)) {
        category = 'Entertainment';
      } else {
        category = 'General';
      }
    }

    let validCommunityId = null;
    let communityInfo = null;
    if (community_id) {
      const commCheck = await pool.query(
        "SELECT id, name, slug, creator_id FROM communities WHERE id::text = $1 OR slug = $1",
        [String(community_id)]
      );
      if (commCheck.rowCount > 0) {
        validCommunityId = commCheck.rows[0].id;
        communityInfo = commCheck.rows[0];

        // PROTECT: Verify user is an active member or creator of the community
        const membershipCheck = await pool.query(
          `SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2
           UNION
           SELECT 1 FROM communities WHERE id = $1 AND creator_id = $2`,
          [validCommunityId, userId]
        );

        if (membershipCheck.rowCount === 0) {
          throw new AppError(403, `You must join c/${communityInfo.slug} before you can post discussions in this community`);
        }
      }
    }

    const hasMedia = Array.isArray(media_ids) && media_ids.length > 0;
    const insertQuery = `
      INSERT INTO posts (user_id, content, views_count, category, community_id, has_media)
      VALUES ($1, $2, 1, $3, $4, $5)
      RETURNING id, user_id, content, category, community_id, views_count, has_media, created_at, updated_at;
    `;
    const result = await pool.query(insertQuery, [userId, content.trim(), category, validCommunityId, hasMedia]);
    const post = result.rows[0];

    // Link uploaded media records to this post
    let attachedMedia = [];
    if (hasMedia) {
      const mediaUpdateRes = await pool.query(
        `UPDATE media 
         SET post_id = $1, updated_at = NOW() 
         WHERE id = ANY($2::uuid[]) AND user_id = $3
         RETURNING id, 
           COALESCE(url_thumb, '${mediaBaseUrl}' || s3_key_raw) as url_thumb,
           COALESCE(url_feed, '${mediaBaseUrl}' || s3_key_raw) as url_feed,
           COALESCE(url_full, '${mediaBaseUrl}' || s3_key_raw) as url_full,
           '${mediaBaseUrl}' || s3_key_raw as url_raw,
           s3_key_raw, width, height, status`,
        [post.id, media_ids, userId]
      );
      attachedMedia = mediaUpdateRes.rows;
    }

    // Fetch author info to return complete post object for immediate UI render
    const userQuery = `SELECT id, name, username, bio, avatar_url FROM users WHERE id = $1;`;
    const userResult = await pool.query(userQuery, [userId]);
    const author = userResult.rows[0];

    const fullPost = {
      ...post,
      author_id: author.id,
      author_name: author.name || author.username,
      username: author.username,
      author_bio: author.bio,
      author_avatar_url: author.avatar_url,
      community_id: validCommunityId,
      community_name: communityInfo?.name || null,
      community_slug: communityInfo?.slug || null,
      likes_count: 0,
      replies_count: 0,
      views_count: 1,
      has_liked: false,
      has_bookmarked: false,
      media: attachedMedia,
    };

    // Dispatch mention notifications (@username in post)
    const mentionMatches = content.match(/@([a-zA-Z0-9_]{3,20})/g);
    if (mentionMatches && mentionMatches.length > 0) {
      const rawUsernames = [...new Set(mentionMatches.map((m) => m.slice(1).toLowerCase()))];
      pool
        .query(
          `SELECT id, username FROM users WHERE LOWER(username) = ANY($1::text[]) AND id != $2`,
          [rawUsernames, userId]
        )
        .then((userRes) => {
          for (const targetUser of userRes.rows) {
            createNotification({
              recipientId: targetUser.id,
              actorId: userId,
              type: "mention",
              postId: post.id,
              messageContent: content.slice(0, 140),
            }).catch((err) =>
              console.error("[MentionNotification] Error:", err.message)
            );
          }
        })
        .catch((err) => console.error("[MentionLookup] Error:", err.message));
    }

    return res
      .status(201)
      .json(new ApiResponse(201, { post: fullPost }, "Post created successfully"));
  } catch (error) {
    next(error);
  }
};

// ─── Live Trending Algorithm ───────────────────────────────────────────────
export const getTrendingTopics = async (req, res, next) => {
  try {
    const query = `
      SELECT 
        '#' || LOWER(match_val) as tag, 
        COUNT(*)::int as post_count 
      FROM (
        SELECT (regexp_matches(content, '#([A-Za-z0-9_]+)', 'g'))[1] as match_val 
        FROM posts
      ) sub 
      GROUP BY LOWER(match_val) 
      ORDER BY post_count DESC, tag ASC 
      LIMIT 10;
    `;
    const result = await pool.query(query);

    const trends = result.rows.map((row, index) => ({
      rank: index + 1,
      tag: row.tag,
      posts: row.post_count,
      formatted_posts: row.post_count > 999 
        ? `${(row.post_count / 1000).toFixed(1)}K` 
        : `${row.post_count} ${row.post_count === 1 ? 'post' : 'posts'}`
    }));

    return res.status(200).json(
      new ApiResponse(200, { trends }, "Live trending topics fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

// ─── 2. Get Global Feed (Cursor-based Pagination & Filtering) ───────────────────────────
export const getFeed = async (req, res, next) => {
  try {
    const cursor = req.query.cursor;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const filter = (req.query.filter || req.query.type || '').toLowerCase();
    const category = (req.query.category || '').trim();
    const currentUserId = req.user?.id || null;

    // If following tab requested by unauthenticated user, return empty feed
    if (filter === 'following' && !currentUserId) {
      return res.status(200).json(
        new ApiResponse(200, { posts: [], nextCursor: null, count: 0 }, "Feed fetched successfully")
      );
    }

    // Search query support for Explore & Search bar
    const search = (req.query.q || req.query.search || req.query.tag || '').trim();
    if (search) {
      const cleanSearch = search.replace(/^@/, '').trim();
      const searchParam = `%${search}%`;
      const cleanParam = `%${cleanSearch}%`;
      const sQuery = currentUserId ? `
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
          EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked,
          EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = $1) as has_bookmarked,
          ${MEDIA_JSON_SELECT}
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN communities comm ON p.community_id = comm.id
        WHERE p.content ILIKE $2 OR p.content ILIKE $3 OR u.username ILIKE $3 OR u.name ILIKE $3
        ORDER BY p.created_at DESC
        LIMIT $4;
      ` : `
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
          false as has_liked,
          false as has_bookmarked,
          ${MEDIA_JSON_SELECT}
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN communities comm ON p.community_id = comm.id
        WHERE p.content ILIKE $1 OR p.content ILIKE $2 OR u.username ILIKE $2 OR u.name ILIKE $2
        ORDER BY p.created_at DESC
        LIMIT $3;
      `;
      const sParams = currentUserId ? [currentUserId, searchParam, cleanParam, limit] : [searchParam, cleanParam, limit];
      const sResult = await pool.query(sQuery, sParams);
      return res.status(200).json(
        new ApiResponse(200, { posts: sResult.rows, nextCursor: null, count: sResult.rowCount }, "Search results fetched successfully")
      );
    }

    let whereClauses = [];
    let params = [];
    let paramIndex = 1;

    let userParamIndex = null;
    if (currentUserId) {
      params.push(currentUserId);
      userParamIndex = paramIndex++;
    }

    let joinFollows = false;
    if (filter === 'following') {
      joinFollows = true;
    }

    if (category) {
      params.push(category);
      const catIdx = paramIndex++;
      const cleanTag = category.replace(/[^a-zA-Z0-9]/g, '');
      params.push(`%#${cleanTag}%`);
      const tagIdx = paramIndex++;
      whereClauses.push(`(p.category ILIKE $${catIdx} OR p.content ILIKE $${tagIdx})`);
    }

    if (cursor) {
      params.push(cursor);
      whereClauses.push(`p.created_at < $${paramIndex++}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const followJoinSql = joinFollows ? `JOIN follows f ON f.following_id = p.user_id AND f.follower_id = $${userParamIndex}` : '';

    let orderSql = 'ORDER BY p.created_at DESC';
    if (filter === 'trending') {
      orderSql = 'ORDER BY ((SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) * 3 + (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) * 2 + COALESCE(p.views_count, 0)) DESC, p.created_at DESC';
    }

    params.push(limit);
    const limitIdx = paramIndex++;

    const selectLiked = currentUserId ? `EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $${userParamIndex}) as has_liked` : 'false as has_liked';
    const selectBookmarked = currentUserId ? `EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = $${userParamIndex}) as has_bookmarked` : 'false as has_bookmarked';

    const query = `
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
      ${followJoinSql}
      ${whereSql}
      ${orderSql}
      LIMIT $${limitIdx};
    `;

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
    const tab = (req.query.tab || 'posts').toLowerCase();
    const currentUserId = req.user?.id || null;

    // Check user exists
    const userResult = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
    if (userResult.rowCount === 0) {
      throw new AppError(404, "User not found");
    }
    const profileUserId = userResult.rows[0].id;

    let query;
    let params;

    if (tab === 'likes') {
      // ─── TAB: LIKES (Posts liked by this profile user) ───
      if (currentUserId) {
        if (cursor) {
          query = `
            SELECT 
              p.id,
              p.content,
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
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked,
              ${MEDIA_JSON_SELECT},
              lk.created_at as liked_at
            FROM likes lk
            JOIN posts p ON lk.post_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE lk.user_id = $2 AND lk.created_at < $3
            ORDER BY lk.created_at DESC
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
              COALESCE(p.views_count, 0) as views_count,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) as replies_count,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked,
              ${MEDIA_JSON_SELECT},
              lk.created_at as liked_at
            FROM likes lk
            JOIN posts p ON lk.post_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE lk.user_id = $2
            ORDER BY lk.created_at DESC
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
              COALESCE(p.views_count, 0) as views_count,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) as replies_count,
              false as has_liked,
              ${MEDIA_JSON_SELECT},
              lk.created_at as liked_at
            FROM likes lk
            JOIN posts p ON lk.post_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE lk.user_id = $1 AND lk.created_at < $2
            ORDER BY lk.created_at DESC
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
              COALESCE(p.views_count, 0) as views_count,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) as replies_count,
              false as has_liked,
              ${MEDIA_JSON_SELECT},
              lk.created_at as liked_at
            FROM likes lk
            JOIN posts p ON lk.post_id = p.id
            JOIN users u ON p.user_id = u.id
            WHERE lk.user_id = $1
            ORDER BY lk.created_at DESC
            LIMIT $2;
          `;
          params = [profileUserId, limit];
        }
      }
    } else if (tab === 'replies') {
      // ─── TAB: REPLIES (Comments made by this profile user) ───
      if (currentUserId) {
        if (cursor) {
          query = `
            SELECT 
              c.id,
              c.content,
              c.created_at,
              c.updated_at,
              c.parent_id,
              c.post_id,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              p.content as parent_post_content,
              pu.username as parent_post_author_username,
              pu.name as parent_post_author_name,
              (SELECT COUNT(*)::int FROM comment_likes cl WHERE cl.comment_id = c.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments cr WHERE cr.parent_id = c.id) as replies_count,
              EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $1) as has_liked
            FROM comments c
            JOIN users u ON c.user_id = u.id
            JOIN posts p ON c.post_id = p.id
            JOIN users pu ON p.user_id = pu.id
            WHERE c.user_id = $2 AND c.created_at < $3
            ORDER BY c.created_at DESC
            LIMIT $4;
          `;
          params = [currentUserId, profileUserId, cursor, limit];
        } else {
          query = `
            SELECT 
              c.id,
              c.content,
              c.created_at,
              c.updated_at,
              c.parent_id,
              c.post_id,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              p.content as parent_post_content,
              pu.username as parent_post_author_username,
              pu.name as parent_post_author_name,
              (SELECT COUNT(*)::int FROM comment_likes cl WHERE cl.comment_id = c.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments cr WHERE cr.parent_id = c.id) as replies_count,
              EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $1) as has_liked
            FROM comments c
            JOIN users u ON c.user_id = u.id
            JOIN posts p ON c.post_id = p.id
            JOIN users pu ON p.user_id = pu.id
            WHERE c.user_id = $2
            ORDER BY c.created_at DESC
            LIMIT $3;
          `;
          params = [currentUserId, profileUserId, limit];
        }
      } else {
        if (cursor) {
          query = `
            SELECT 
              c.id,
              c.content,
              c.created_at,
              c.updated_at,
              c.parent_id,
              c.post_id,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              p.content as parent_post_content,
              pu.username as parent_post_author_username,
              pu.name as parent_post_author_name,
              (SELECT COUNT(*)::int FROM comment_likes cl WHERE cl.comment_id = c.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments cr WHERE cr.parent_id = c.id) as replies_count,
              false as has_liked
            FROM comments c
            JOIN users u ON c.user_id = u.id
            JOIN posts p ON c.post_id = p.id
            JOIN users pu ON p.user_id = pu.id
            WHERE c.user_id = $1 AND c.created_at < $2
            ORDER BY c.created_at DESC
            LIMIT $3;
          `;
          params = [profileUserId, cursor, limit];
        } else {
          query = `
            SELECT 
              c.id,
              c.content,
              c.created_at,
              c.updated_at,
              c.parent_id,
              c.post_id,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              p.content as parent_post_content,
              pu.username as parent_post_author_username,
              pu.name as parent_post_author_name,
              (SELECT COUNT(*)::int FROM comment_likes cl WHERE cl.comment_id = c.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments cr WHERE cr.parent_id = c.id) as replies_count,
              false as has_liked
            FROM comments c
            JOIN users u ON c.user_id = u.id
            JOIN posts p ON c.post_id = p.id
            JOIN users pu ON p.user_id = pu.id
            WHERE c.user_id = $1
            ORDER BY c.created_at DESC
            LIMIT $2;
          `;
          params = [profileUserId, limit];
        }
      }
    } else if (tab === 'media') {
      // ─── TAB: MEDIA (Posts containing images or media links) ───
      const mediaPattern = `(https?://[^\\s]+(\\.(jpg|jpeg|png|gif|webp|svg|bmp)|images\\.unsplash\\.com|imgur\\.com|i\\.pinimg\\.com|media\\.giphy\\.com|res\\.cloudinary\\.com))`;
      if (currentUserId) {
        if (cursor) {
          query = `
            SELECT 
              p.id,
              p.content,
              p.created_at,
              p.updated_at,
              p.has_media,
              COALESCE(p.views_count, 0) as views_count,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) as replies_count,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked,
              ${MEDIA_JSON_SELECT}
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = $2
              AND (p.has_media = true OR p.content ~* '${mediaPattern}' OR p.content ILIKE '%![%](%)%')
              AND p.created_at < $3
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
              p.has_media,
              COALESCE(p.views_count, 0) as views_count,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) as replies_count,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked,
              ${MEDIA_JSON_SELECT}
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = $2
              AND (p.has_media = true OR p.content ~* '${mediaPattern}' OR p.content ILIKE '%![%](%)%')
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
              p.has_media,
              COALESCE(p.views_count, 0) as views_count,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) as replies_count,
              false as has_liked,
              ${MEDIA_JSON_SELECT}
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = $1
              AND (p.has_media = true OR p.content ~* '${mediaPattern}' OR p.content ILIKE '%![%](%)%')
              AND p.created_at < $2
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
              p.has_media,
              COALESCE(p.views_count, 0) as views_count,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) as replies_count,
              false as has_liked,
              ${MEDIA_JSON_SELECT}
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = $1
              AND (p.has_media = true OR p.content ~* '${mediaPattern}' OR p.content ILIKE '%![%](%)%')
            ORDER BY p.created_at DESC
            LIMIT $2;
          `;
          params = [profileUserId, limit];
        }
      }
    } else {
      // ─── TAB: POSTS (Authored by this user - DEFAULT) ───
      if (currentUserId) {
        if (cursor) {
          query = `
            SELECT 
              p.id,
              p.content,
              p.created_at,
              p.updated_at,
              p.has_media,
              COALESCE(p.views_count, 0) as views_count,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) as replies_count,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked,
              ${MEDIA_JSON_SELECT}
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
              p.has_media,
              COALESCE(p.views_count, 0) as views_count,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) as replies_count,
              EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked,
              ${MEDIA_JSON_SELECT}
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
              p.has_media,
              COALESCE(p.views_count, 0) as views_count,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) as replies_count,
              false as has_liked,
              ${MEDIA_JSON_SELECT}
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
              p.has_media,
              COALESCE(p.views_count, 0) as views_count,
              u.id as author_id,
              u.name as author_name,
              u.username,
              u.bio as author_bio,
          u.avatar_url as author_avatar_url,
              (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
              (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) as replies_count,
              false as has_liked,
              ${MEDIA_JSON_SELECT}
            FROM posts p
            JOIN users u ON p.user_id = u.id
            WHERE p.user_id = $1
            ORDER BY p.created_at DESC
            LIMIT $2;
          `;
          params = [profileUserId, limit];
        }
      }
    }

    const result = await pool.query(query, params);
    const items = result.rows;

    let nextCursor = null;
    if (items.length === limit) {
      nextCursor = tab === 'likes' && items[items.length - 1].liked_at
        ? items[items.length - 1].liked_at
        : items[items.length - 1].created_at;
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        { 
          posts: items, 
          items, 
          replies: items, 
          nextCursor, 
          count: items.length, 
          tab 
        },
        `User ${tab} fetched successfully`
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

    // Increment views_count automatically on view
    await pool.query(
      "UPDATE posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = $1;",
      [id]
    );

    let query;
    let params;

    if (currentUserId) {
      query = `
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
          EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked,
          EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = $1) as has_bookmarked,
          ${MEDIA_JSON_SELECT}
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN communities comm ON p.community_id = comm.id
        WHERE p.id = $2;
      `;
      params = [currentUserId, id];
    } else {
      query = `
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
          false as has_liked,
          false as has_bookmarked,
          ${MEDIA_JSON_SELECT}
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN communities comm ON p.community_id = comm.id
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

// ─── 4b. Record Post View (Explicit Impressions) ─────────────────────────────
export const recordPostView = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = $1 RETURNING views_count;",
      [id]
    );
    if (result.rowCount === 0) {
      throw new AppError(404, "Post not found");
    }
    return res.status(200).json(
      new ApiResponse(200, { views_count: result.rows[0].views_count }, "Post view recorded")
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
    const postCheck = await pool.query("SELECT id, user_id FROM posts WHERE id = $1", [id]);
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

      // In-app Notification to post author
      await createNotification({
        recipientId: postCheck.rows[0].user_id,
        actorId: userId,
        type: 'post_like',
        postId: id,
      });
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

// ─── 8. Create Comment / Reply on Post ──────────────────────────────────────
export const createComment = async (req, res, next) => {
  try {
    const { id: postId } = req.params;
    const { content, parent_id } = req.body;
    const userId = req.user.id;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      throw new AppError(400, "Comment cannot be empty");
    }

    if (content.trim().length > 500) {
      throw new AppError(400, "Comment cannot exceed 500 characters");
    }

    // Verify post exists
    const postCheck = await pool.query("SELECT id, user_id FROM posts WHERE id = $1", [postId]);
    if (postCheck.rowCount === 0) {
      throw new AppError(404, "Post not found");
    }

    // If parent_id is provided, verify it exists and belongs to this post
    let parentAuthorId = null;
    if (parent_id) {
      const parentCheck = await pool.query("SELECT id, user_id FROM comments WHERE id = $1 AND post_id = $2", [parent_id, postId]);
      if (parentCheck.rowCount === 0) {
        throw new AppError(404, "Parent comment not found");
      }
      parentAuthorId = parentCheck.rows[0].user_id;
    }

    // Insert comment
    const insertQuery = `
      INSERT INTO comments (post_id, user_id, content, parent_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, post_id, user_id, content, parent_id, created_at, updated_at;
    `;
    const result = await pool.query(insertQuery, [postId, userId, content.trim(), parent_id || null]);
    const comment = result.rows[0];

    // Notification: Reply to comment vs Top-level comment
    if (parent_id && parentAuthorId) {
      // 1. Notify parent comment author
      await createNotification({
        recipientId: parentAuthorId,
        actorId: userId,
        type: 'comment_reply',
        postId,
        commentId: comment.id,
        messageContent: content.trim(),
      });
      // 2. If post author is different, also notify them
      if (postCheck.rows[0].user_id !== parentAuthorId) {
        await createNotification({
          recipientId: postCheck.rows[0].user_id,
          actorId: userId,
          type: 'post_comment',
          postId,
          commentId: comment.id,
          messageContent: content.trim(),
        });
      }
    } else {
      // Top-level comment on post
      await createNotification({
        recipientId: postCheck.rows[0].user_id,
        actorId: userId,
        type: 'post_comment',
        postId,
        commentId: comment.id,
        messageContent: content.trim(),
      });
    }

    // Dispatch mention notifications (@username in comments)
    const commentMentions = content.match(/@([a-zA-Z0-9_]{3,20})/g);
    if (commentMentions && commentMentions.length > 0) {
      const rawUsernames = [...new Set(commentMentions.map((m) => m.slice(1).toLowerCase()))];
      pool
        .query(
          `SELECT id, username FROM users WHERE LOWER(username) = ANY($1::text[]) AND id != $2`,
          [rawUsernames, userId]
        )
        .then((userRes) => {
          for (const targetUser of userRes.rows) {
            if (
              targetUser.id !== postCheck.rows[0].user_id &&
              targetUser.id !== parentAuthorId
            ) {
              createNotification({
                recipientId: targetUser.id,
                actorId: userId,
                type: "mention",
                postId,
                commentId: comment.id,
                messageContent: content.slice(0, 140),
              }).catch((err) =>
                console.error("[CommentMentionNotification] Error:", err.message)
              );
            }
          }
        })
        .catch((err) => console.error("[CommentMentionLookup] Error:", err.message));
    }

    // Fetch author info
    const userResult = await pool.query("SELECT username, bio, avatar_url, name FROM users WHERE id = $1", [userId]);
    const author = userResult.rows[0];

    const fullComment = {
      ...comment,
      author_id: userId,
      author_name: author?.name || author?.username,
      username: author?.username,
      author_bio: author?.bio,
      author_avatar_url: author?.avatar_url,
      likes_count: 0,
      has_liked: false,
    };

    // Also get updated replies count for post
    const countResult = await pool.query("SELECT COUNT(*)::int as count FROM comments WHERE post_id = $1", [postId]);

    return res.status(201).json(
      new ApiResponse(201, { comment: fullComment, replies_count: countResult.rows[0].count }, "Reply posted successfully")
    );
  } catch (error) {
    next(error);
  }
};

// ─── 9. Get Comments for a Post ─────────────────────────────────────────────
export const getComments = async (req, res, next) => {
  try {
    const { id: postId } = req.params;
    const currentUserId = req.user?.id || null;

    // Verify post exists
    const postCheck = await pool.query("SELECT id FROM posts WHERE id = $1", [postId]);
    if (postCheck.rowCount === 0) {
      throw new AppError(404, "Post not found");
    }

    let query;
    let params;

    if (currentUserId) {
      query = `
        SELECT 
          c.id,
          c.post_id,
          c.parent_id,
          c.content,
          c.created_at,
          c.updated_at,
          u.id as author_id,
          u.name as author_name,
          u.username,
          u.bio as author_bio,
          u.avatar_url as author_avatar_url,
          (SELECT COUNT(*)::int FROM comment_likes cl WHERE cl.comment_id = c.id) as likes_count,
          EXISTS(SELECT 1 FROM comment_likes cl WHERE cl.comment_id = c.id AND cl.user_id = $2) as has_liked
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC;
      `;
      params = [postId, currentUserId];
    } else {
      query = `
        SELECT 
          c.id,
          c.post_id,
          c.parent_id,
          c.content,
          c.created_at,
          c.updated_at,
          u.id as author_id,
          u.name as author_name,
          u.username,
          u.bio as author_bio,
          u.avatar_url as author_avatar_url,
          (SELECT COUNT(*)::int FROM comment_likes cl WHERE cl.comment_id = c.id) as likes_count,
          false as has_liked
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC;
      `;
      params = [postId];
    }

    const result = await pool.query(query, params);

    return res.status(200).json(
      new ApiResponse(200, { comments: result.rows, count: result.rowCount }, "Comments fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

// ─── 10. Delete Comment (Comment Author or Post Author) ──────────────────────
export const deleteComment = async (req, res, next) => {
  try {
    const { id: commentId } = req.params;
    const userId = req.user.id;

    // Find comment and post author
    const query = `
      SELECT c.user_id as comment_author_id, p.user_id as post_author_id, c.post_id
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      WHERE c.id = $1;
    `;
    const result = await pool.query(query, [commentId]);

    if (result.rowCount === 0) {
      throw new AppError(404, "Comment not found");
    }

    const { comment_author_id, post_author_id, post_id } = result.rows[0];

    if (comment_author_id !== userId && post_author_id !== userId) {
      throw new AppError(403, "Forbidden: You are not authorized to delete this comment");
    }

    await pool.query("DELETE FROM comments WHERE id = $1", [commentId]);

    // Updated count
    const countResult = await pool.query("SELECT COUNT(*)::int as count FROM comments WHERE post_id = $1", [post_id]);

    return res.status(200).json(
      new ApiResponse(200, { id: commentId, post_id, replies_count: countResult.rows[0].count }, "Comment deleted successfully")
    );
  } catch (error) {
    next(error);
  }
};

// ─── 11. Toggle Comment Like ───────────────────────────────────────────────
export const toggleCommentLike = async (req, res, next) => {
  try {
    const { id: commentId } = req.params;
    const userId = req.user.id;

    // Check if comment exists
    const commentCheck = await pool.query("SELECT id, user_id, post_id FROM comments WHERE id = $1", [commentId]);
    if (commentCheck.rowCount === 0) {
      throw new AppError(404, "Comment not found");
    }

    const likeCheck = await pool.query(
      "SELECT 1 FROM comment_likes WHERE user_id = $1 AND comment_id = $2",
      [userId, commentId]
    );

    let liked = false;
    if (likeCheck.rowCount > 0) {
      await pool.query(
        "DELETE FROM comment_likes WHERE user_id = $1 AND comment_id = $2",
        [userId, commentId]
      );
      liked = false;
    } else {
      await pool.query(
        "INSERT INTO comment_likes (user_id, comment_id) VALUES ($1, $2)",
        [userId, commentId]
      );
      liked = true;

      // In-app Notification to comment author
      await createNotification({
        recipientId: commentCheck.rows[0].user_id,
        actorId: userId,
        type: 'comment_like',
        postId: commentCheck.rows[0].post_id,
        commentId,
      });
    }

    const countResult = await pool.query(
      "SELECT COUNT(*)::int as count FROM comment_likes WHERE comment_id = $1",
      [commentId]
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        { liked, likes_count: countResult.rows[0].count },
        liked ? "Comment liked successfully" : "Comment unliked successfully"
      )
    );
  } catch (error) {
    next(error);
  }
};

// ─── 12. Toggle Bookmark on Post ───────────────────────────────────────────
export const toggleBookmark = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const postCheck = await pool.query("SELECT id FROM posts WHERE id = $1", [id]);
    if (postCheck.rowCount === 0) {
      throw new AppError(404, "Post not found");
    }

    const check = await pool.query(
      "SELECT 1 FROM bookmarks WHERE user_id = $1 AND post_id = $2",
      [userId, id]
    );

    let bookmarked = false;
    if (check.rowCount > 0) {
      await pool.query("DELETE FROM bookmarks WHERE user_id = $1 AND post_id = $2", [userId, id]);
      bookmarked = false;
    } else {
      await pool.query(
        "INSERT INTO bookmarks (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [userId, id]
      );
      bookmarked = true;
    }

    return res.status(200).json(
      new ApiResponse(200, { bookmarked }, bookmarked ? "Post bookmarked" : "Bookmark removed")
    );
  } catch (error) {
    next(error);
  }
};

// ─── 13. Get User's Bookmarks ──────────────────────────────────────────────
export const getBookmarks = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const query = `
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
        EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked,
        true as has_bookmarked,
        ${MEDIA_JSON_SELECT}
      FROM bookmarks b
      JOIN posts p ON b.post_id = p.id
      JOIN users u ON p.user_id = u.id
      LEFT JOIN communities comm ON p.community_id = comm.id
      WHERE b.user_id = $1
      ORDER BY b.created_at DESC;
    `;
    const result = await pool.query(query, [userId]);
    return res.status(200).json(
      new ApiResponse(200, { posts: result.rows, count: result.rowCount }, "Bookmarks fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/posts/:id/preview - Dynamic Open Graph HTML for social media crawlers
export const getPostPreviewHtml = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        p.id,
        p.content,
        u.name as author_name,
        u.username,
        u.avatar_url,
        ${MEDIA_JSON_SELECT}
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = $1;
    `;
    const result = await pool.query(query, [id]);
    if (result.rowCount === 0) {
      return res.redirect("https://solitx.soumya.site");
    }

    const post = result.rows[0];
    const author = post.author_name || post.username;
    const title = `${author} (@${post.username}) on SOLITX`;
    const description = (post.content || "").slice(0, 240);
    
    // Check if post has media image
    let imageUrl = "https://solitx.soumya.site/og-image.png";
    if (post.media && Array.isArray(post.media) && post.media.length > 0) {
      const firstMedia = post.media[0];
      imageUrl = firstMedia.url_full || firstMedia.url_feed || firstMedia.url_raw || imageUrl;
    }

    const postUrl = `https://solitx.soumya.site/post/${post.id}`;

    const escapeHtml = (str) =>
      String(str || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">

  <!-- Open Graph / WhatsApp / Facebook / LinkedIn / Discord -->
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="SOLITX">
  <meta property="og:url" content="${escapeHtml(postUrl)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}">
  <meta property="og:image:alt" content="Post image on SOLITX">

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@solitx">
  <meta name="twitter:url" content="${escapeHtml(postUrl)}">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}">

  <!-- Instant redirect for real browsers -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(postUrl)}">
  <script>
    window.location.replace("${escapeHtml(postUrl)}");
  </script>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0F1419; color: #FFFFFF; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; text-align: center; padding: 20px;">
  <div>
    <h2 style="margin-bottom: 8px;">SOLITX</h2>
    <p style="color: #94A3B8;">Redirecting to post...</p>
    <a href="${escapeHtml(postUrl)}" style="color: #A855F7; text-decoration: underline;">Click here if not redirected automatically</a>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (error) {
    next(error);
  }
};
