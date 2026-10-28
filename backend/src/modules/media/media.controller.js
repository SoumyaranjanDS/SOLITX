import pool from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { generatePresignedUploadUrl, buildPublicMediaUrl } from "../../services/s3Service.js";
import { enqueueJob } from "../../queue/jobQueue.js";
import { HANDLERS } from "../../worker.js";

/**
 * 1. Request Presigned Upload URL
 * POST /api/v1/media/upload-url
 * Direct-to-S3: Client receives a signed AWS S3 PUT URL. Zero load on API server.
 */
export const requestUploadUrl = async (req, res, next) => {
  try {
    const { mime_type, file_size_bytes } = req.body;
    const userId = req.user.id;

    if (!mime_type) {
      throw new AppError(400, "Field 'mime_type' is required (e.g. 'image/jpeg', 'image/png').");
    }

    // 1. Generate S3 signed upload grant
    const { uploadUrl, s3Key, bucket, expiresInSeconds } = await generatePresignedUploadUrl({
      userId,
      mimeType: mime_type,
      fileSizeBytes: file_size_bytes,
    });

    // 2. Pre-record media entry in PostgreSQL with 'pending' status (Two-Phase Commit)
    const result = await pool.query(
      `INSERT INTO media (user_id, s3_key_raw, mime_type, file_size_bytes, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, user_id, s3_key_raw, mime_type, status, created_at`,
      [userId, s3Key, mime_type, file_size_bytes || null]
    );

    const media = result.rows[0];
    const publicUrl = buildPublicMediaUrl(s3Key);

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          media_id: media.id,
          upload_url: uploadUrl,
          public_url: publicUrl,
          s3_key: s3Key,
          bucket,
          expires_in: expiresInSeconds,
          status: media.status,
        },
        "Presigned S3 upload URL generated successfully. Upload directly to S3 via PUT."
      )
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 2. Confirm Direct S3 Upload & Enqueue Processing Pipeline
 * POST /api/v1/media/confirm
 * Client calls this once browser finishes PUT request to S3.
 */
export const confirmUpload = async (req, res, next) => {
  try {
    const { media_id, entity_type } = req.body;
    const userId = req.user.id;

    if (!media_id) {
      throw new AppError(400, "Field 'media_id' is required.");
    }

    // Verify ownership and pending status
    const mediaRes = await pool.query(
      `SELECT * FROM media WHERE id = $1 AND user_id = $2`,
      [media_id, userId]
    );

    if (mediaRes.rowCount === 0) {
      throw new AppError(404, "Media item not found or you do not have permission.");
    }

    const media = mediaRes.rows[0];

    // Compute deterministic optimized WebP CDN URLs
    const baseKey = `optimized/${userId}/${media.id}`;
    const keyThumb = `${baseKey}_thumb.webp`;
    const keyFeed = `${baseKey}_feed.webp`;
    const keyFull = `${baseKey}_full.webp`;
    const urlThumb = buildPublicMediaUrl(keyThumb);
    const urlFeed = buildPublicMediaUrl(keyFeed);
    const urlFull = buildPublicMediaUrl(keyFull);

    // Transition status to processing
    await pool.query(
      `UPDATE media SET status = 'processing', updated_at = NOW() WHERE id = $1`,
      [media_id]
    );

    // Enqueue to background worker for Sharp image optimization & WebP generation
    let jobId = null;
    let isProcessedInline = false;
    try {
      jobId = await enqueueJob("media_processing", {
        mediaId: media.id,
        userId: media.user_id,
        s3KeyRaw: media.s3_key_raw,
        mimeType: media.mime_type,
        entityType: entity_type || null,
        idempotency_key: `media:process:${media.id}`,
      });
    } catch (queueErr) {
      console.warn(
        `[MediaConfirm] Redis queue unavailable (${queueErr.message}). Executing Sharp worker synchronously inline...`
      );
      try {
        if (HANDLERS?.media_processing) {
          await HANDLERS.media_processing({
            data: {
              mediaId: media.id,
              userId: media.user_id,
              s3KeyRaw: media.s3_key_raw,
              mimeType: media.mime_type,
              entityType: entity_type || null,
            },
          });
          isProcessedInline = true;
          jobId = `inline_${Date.now()}`;
        }
      } catch (inlineErr) {
        console.error(`[MediaConfirm] Inline processing failed:`, inlineErr.message);
        await pool.query(
          `UPDATE media SET status = 'ready', updated_at = NOW() WHERE id = $1`,
          [media_id]
        );
      }
    }

    // Check if worker already finished
    const freshMediaRes = await pool.query(
      `SELECT status, url_thumb, url_feed, url_full FROM media WHERE id = $1`,
      [media_id]
    );
    const freshMedia = freshMediaRes.rows[0];
    const isReady = freshMedia?.status === 'ready' || isProcessedInline;

    const resolvedUrlFeed = freshMedia?.url_feed || urlFeed;
    const resolvedUrlThumb = freshMedia?.url_thumb || urlThumb;
    const resolvedUrlFull = freshMedia?.url_full || urlFull;

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          media_id: media.id,
          public_url: resolvedUrlFeed,
          url_thumb: resolvedUrlThumb,
          url_feed: resolvedUrlFeed,
          url_full: resolvedUrlFull,
          status: isReady ? "ready" : (jobId ? "processing" : "ready"),
          job_id: jobId,
        },
        jobId
          ? "Media upload confirmed. Processing queued asynchronously."
          : "Media upload confirmed. Ready via direct cloud storage."
      )
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 3. Get Media Status / Details
 * GET /api/v1/media/:id
 */
export const getMediaStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT id, user_id, post_id, status, url_thumb, url_feed, url_full, 
              width, height, mime_type, file_size_bytes, error_message, created_at, updated_at
       FROM media WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      throw new AppError(404, "Media not found");
    }

    const media = result.rows[0];

    return res.status(200).json(
      new ApiResponse(200, media, "Media status retrieved successfully.")
    );
  } catch (err) {
    next(err);
  }
};
