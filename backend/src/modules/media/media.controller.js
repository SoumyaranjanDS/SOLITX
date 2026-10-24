import pool from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { generatePresignedUploadUrl, buildPublicMediaUrl } from "../../services/s3Service.js";
import { enqueueJob } from "../../queue/jobQueue.js";

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

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          media_id: media.id,
          upload_url: uploadUrl,
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
    const { media_id } = req.body;
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

    // Transition status to processing
    await pool.query(
      `UPDATE media SET status = 'processing', updated_at = NOW() WHERE id = $1`,
      [media_id]
    );

    // Enqueue to background worker for Sharp image optimization & WebP generation
    const jobId = await enqueueJob("media_processing", {
      mediaId: media.id,
      userId: media.user_id,
      s3KeyRaw: media.s3_key_raw,
      mimeType: media.mime_type,
      idempotency_key: `media:process:${media.id}`,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          media_id: media.id,
          status: "processing",
          job_id: jobId,
        },
        "Media upload confirmed. Processing queued asynchronously."
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
