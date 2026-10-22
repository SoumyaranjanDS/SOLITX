import pool from "../config/db.js";
import { enqueueJob } from "../queue/jobQueue.js";

/**
 * Creates an in-app notification asynchronously via Redis Queue.
 * Supported types: 'post_like', 'post_comment', 'comment_reply', 'comment_like', 'message', 'follow'
 */
export const createNotification = async ({
  recipientId,
  actorId,
  type,
  postId = null,
  commentId = null,
  messageContent = null,
}) => {
  try {
    if (!recipientId || !actorId || recipientId === actorId) {
      return null;
    }

    // DAY 26: Asynchronous Decoupling via Redis Job Queue
    // Instead of holding the database connection open in the HTTP request loop,
    // we enqueue the notification event to Redis in < 5ms and return immediately.
    const jobId = await enqueueJob("notifications", {
      recipientId,
      actorId,
      type,
      postId,
      commentId,
      messageContent,
    });

    return { queued: true, jobId };
  } catch (error) {
    console.error("Failed to enqueue notification job to Redis:", error.message);
    // Fallback: in case Redis is momentarily unavailable, attempt direct DB write
    try {
      const fallbackQuery = `
        INSERT INTO notifications (recipient_id, actor_id, type, post_id, comment_id, message_content)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, recipient_id, actor_id, type, post_id, comment_id, message_content, is_read, created_at;
      `;
      const fallbackRes = await pool.query(fallbackQuery, [
        recipientId,
        actorId,
        type,
        postId,
        commentId,
        messageContent,
      ]);
      return fallbackRes.rows[0];
    } catch (fallbackErr) {
      console.error("Fallback notification creation also failed:", fallbackErr.message);
      return null;
    }
  }
};

/**
 * Direct synchronous insert (used by background workers or admin migrations)
 */
export const insertNotificationDirect = async ({
  recipientId,
  actorId,
  type,
  postId = null,
  commentId = null,
  messageContent = null,
}) => {
  if (!recipientId || !actorId || recipientId === actorId) {
    return null;
  }

  const query = `
    INSERT INTO notifications (recipient_id, actor_id, type, post_id, comment_id, message_content)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, recipient_id, actor_id, type, post_id, comment_id, message_content, is_read, created_at;
  `;
  const result = await pool.query(query, [
    recipientId,
    actorId,
    type,
    postId,
    commentId,
    messageContent,
  ]);
  return result.rows[0];
};
