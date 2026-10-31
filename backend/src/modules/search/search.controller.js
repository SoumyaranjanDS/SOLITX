import pool from "../../config/db.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { MEDIA_JSON_SELECT } from "../posts/post.controller.js";

// GET /api/v1/search
export const searchAll = async (req, res, next) => {
  try {
    const currentUserId = req.user?.id || null;
    const rawQuery = (req.query.q || req.query.search || "").trim();
    const type = (req.query.type || "all").toLowerCase(); // 'all', 'users', 'people', 'posts', 'communities', 'lists'
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

    const isHandle = rawQuery.startsWith("@");
    const cleanQuery = rawQuery.replace(/^@/, "").trim();

    if (!rawQuery) {
      return res.status(200).json(
        new ApiResponse(200, {
          query: "",
          cleanQuery: "",
          isHandleSearch: false,
          users: [],
          posts: [],
          communities: [],
          lists: [],
          counts: { users: 0, posts: 0, communities: 0, lists: 0 }
        }, "Empty search query")
      );
    }

    const searchParam = `%${rawQuery}%`;
    const cleanParam = `%${cleanQuery}%`;
    const exactClean = cleanQuery;
    const startsClean = `${cleanQuery}%`;

    const shouldFetchUsers = type === "all" || type === "users" || type === "people";
    const shouldFetchPosts = type === "all" || type === "posts";
    const shouldFetchCommunities = type === "all" || type === "communities";
    const shouldFetchLists = type === "all" || type === "lists";

    const promises = [];

    // 1. Users / People search
    if (shouldFetchUsers) {
      const userParams = [searchParam, cleanParam, exactClean, startsClean, limit];
      let authSelect = "false as is_following";
      if (currentUserId) {
        userParams.unshift(currentUserId);
        authSelect = `EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) as is_following`;
      }
      const uOffset = currentUserId ? 1 : 0;

      const userSql = `
        SELECT 
          u.id, 
          u.username, 
          u.name, 
          u.bio, 
          u.avatar_url,
          (SELECT COUNT(*)::int FROM follows WHERE following_id = u.id) as followers_count,
          ${authSelect}
        FROM users u
        WHERE (u.username ILIKE $${1 + uOffset} OR u.username ILIKE $${2 + uOffset} 
            OR u.name ILIKE $${1 + uOffset} OR u.name ILIKE $${2 + uOffset} 
            OR u.bio ILIKE $${1 + uOffset} OR u.bio ILIKE $${2 + uOffset})
        ORDER BY 
          (CASE 
             WHEN LOWER(u.username) = LOWER($${3 + uOffset}) THEN 0
             WHEN LOWER(u.username) LIKE LOWER($${4 + uOffset}) THEN 1
             ELSE 2 
           END),
          followers_count DESC,
          u.created_at DESC
        LIMIT $${5 + uOffset};
      `;
      promises.push(pool.query(userSql, userParams).then(r => r.rows).catch(e => {
        console.error("User search error:", e);
        return [];
      }));
    } else {
      promises.push(Promise.resolve([]));
    }

    // 2. Posts search
    if (shouldFetchPosts) {
      const postParams = [searchParam, cleanParam, limit];
      let authSelect = "false as has_liked, false as has_bookmarked";
      if (currentUserId) {
        postParams.unshift(currentUserId);
        authSelect = `
          EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $1) as has_liked,
          EXISTS(SELECT 1 FROM bookmarks b WHERE b.post_id = p.id AND b.user_id = $1) as has_bookmarked
        `;
      }
      const pOffset = currentUserId ? 1 : 0;

      const postSql = `
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
          ${authSelect},
          ${MEDIA_JSON_SELECT}
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN communities comm ON p.community_id = comm.id
        WHERE (p.content ILIKE $${1 + pOffset} OR p.content ILIKE $${2 + pOffset} 
            OR u.username ILIKE $${2 + pOffset} OR u.name ILIKE $${2 + pOffset})
        ORDER BY p.created_at DESC
        LIMIT $${3 + pOffset};
      `;
      promises.push(pool.query(postSql, postParams).then(r => r.rows).catch(e => {
        console.error("Post search error:", e);
        return [];
      }));
    } else {
      promises.push(Promise.resolve([]));
    }

    // 3. Communities search
    if (shouldFetchCommunities) {
      const commParams = [searchParam, cleanParam, exactClean, startsClean, limit];
      let authSelect = "false as is_joined, false as is_creator";
      if (currentUserId) {
        commParams.unshift(currentUserId);
        authSelect = `
          COALESCE(bool_or(cm.user_id = $1), false) as is_joined,
          (c.creator_id = $1) as is_creator
        `;
      }
      const cOffset = currentUserId ? 1 : 0;

      const commSql = `
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
          ${authSelect}
        FROM communities c
        JOIN users u ON c.creator_id = u.id
        LEFT JOIN community_members cm ON c.id = cm.community_id
        WHERE (c.name ILIKE $${1 + cOffset} OR c.name ILIKE $${2 + cOffset} 
            OR c.description ILIKE $${1 + cOffset} OR c.description ILIKE $${2 + cOffset} 
            OR c.slug ILIKE $${2 + cOffset} OR u.username ILIKE $${2 + cOffset})
        GROUP BY c.id, u.username, u.name
        ORDER BY 
          (CASE 
             WHEN LOWER(c.name) = LOWER($${3 + cOffset}) THEN 0
             WHEN LOWER(c.name) LIKE LOWER($${4 + cOffset}) THEN 1
             ELSE 2 
           END),
          members_count DESC, 
          c.created_at DESC
        LIMIT $${5 + cOffset};
      `;
      promises.push(pool.query(commSql, commParams).then(r => r.rows).catch(e => {
        console.error("Community search error:", e);
        return [];
      }));
    } else {
      promises.push(Promise.resolve([]));
    }

    // 4. Lists search
    if (shouldFetchLists) {
      const listParams = [searchParam, cleanParam, exactClean, startsClean, limit];
      let authSelect = "false as is_following, false as is_pinned, false as is_creator";
      let privateWhere = "l.is_private = false";
      if (currentUserId) {
        listParams.unshift(currentUserId);
        authSelect = `
          COALESCE(bool_or(lf.user_id = $1), false) as is_following,
          COALESCE(bool_or(lf.user_id = $1 AND lf.is_pinned = true), false) as is_pinned,
          (l.creator_id = $1) as is_creator
        `;
        privateWhere = "(l.is_private = false OR l.creator_id = $1)";
      }
      const lOffset = currentUserId ? 1 : 0;

      const listSql = `
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
          ${authSelect}
        FROM lists l
        JOIN users u ON l.creator_id = u.id
        LEFT JOIN list_members lm ON l.id = lm.list_id
        LEFT JOIN list_followers lf ON l.id = lf.list_id
        WHERE ${privateWhere}
          AND (l.name ILIKE $${1 + lOffset} OR l.name ILIKE $${2 + lOffset} 
            OR l.description ILIKE $${1 + lOffset} OR l.description ILIKE $${2 + lOffset} 
            OR u.username ILIKE $${2 + lOffset})
        GROUP BY l.id, u.username, u.name
        ORDER BY 
          (CASE 
             WHEN LOWER(l.name) = LOWER($${3 + lOffset}) THEN 0
             WHEN LOWER(l.name) LIKE LOWER($${4 + lOffset}) THEN 1
             ELSE 2 
           END),
          followers_count DESC, 
          l.created_at DESC
        LIMIT $${5 + lOffset};
      `;
      promises.push(pool.query(listSql, listParams).then(r => r.rows).catch(e => {
        console.error("List search error:", e);
        return [];
      }));
    } else {
      promises.push(Promise.resolve([]));
    }

    const [users, posts, communities, lists] = await Promise.all(promises);

    return res.status(200).json(
      new ApiResponse(200, {
        query: rawQuery,
        cleanQuery,
        isHandleSearch: isHandle,
        users,
        posts,
        communities,
        lists,
        counts: {
          users: users.length,
          posts: posts.length,
          communities: communities.length,
          lists: lists.length
        }
      }, "Search results fetched successfully")
    );
  } catch (error) {
    next(error);
  }
};

