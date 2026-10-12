import pool from "../config/db.js";

/**
 * Creates an in-app notification if recipient is not the actor.
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
  } catch (error) {
    console.error("Failed to create notification:", error.message);
    return null;
  }
};
