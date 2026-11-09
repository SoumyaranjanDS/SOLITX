import pool from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import {
  initiateVideoMultipartUpload,
  getVideoPartUploadUrls,
  completeVideoMultipartUpload,
  abortVideoMultipartUpload,
  buildPublicMediaUrl,
  ALLOWED_VIDEO_MIME_TYPES,
  MAX_VIDEO_SIZE_BYTES,
} from "../../services/s3Service.js";
import { enqueueJob } from "../../queue/jobQueue.js";

/**
 * Helper to format video object with public CDN URLs
 */
export function formatVideoResponse(video) {
  if (!video) return null;
  return {
    id: video.id,
    post_id: video.post_id || null,
    user_id: video.user_id,
    status: video.status,
    hls_url: video.hls_master_key ? buildPublicMediaUrl(video.hls_master_key) : null,
    download_url: video.download_key ? buildPublicMediaUrl(video.download_key) : null,
    thumbnail_url: video.thumbnail_key ? buildPublicMediaUrl(video.thumbnail_key) : null,
    duration_seconds: video.duration_seconds ? parseFloat(video.duration_seconds) : null,
    width: video.width || null,
    height: video.height || null,
    original_filename: video.original_filename || null,
    file_size_bytes: video.file_size_bytes ? parseInt(video.file_size_bytes, 10) : null,
    views_count: video.views_count ? parseInt(video.views_count, 10) : 0,
    error_message: video.error_message || null,
    created_at: video.created_at,
    updated_at: video.updated_at,
  };
}

/**
 * 1. Initiate Video Multipart Upload
 * POST /api/v1/videos/initiate
 */
export const initiateUpload = async (req, res, next) => {
  try {
    const { mime_type, file_size_bytes, original_filename } = req.body;
    const userId = req.user.id;

    if (!mime_type) {
      throw new AppError(400, "Field 'mime_type' is required (e.g. 'video/mp4', 'video/quicktime').");
    }

    if (!ALLOWED_VIDEO_MIME_TYPES.has(mime_type)) {
      throw new AppError(
        400,
        `Unsupported video format '${mime_type}'. Supported: MP4, MOV, WebM, M4V.`
      );
    }

    if (file_size_bytes && file_size_bytes > MAX_VIDEO_SIZE_BYTES) {
      throw new AppError(
        400,
        `Video size (${(file_size_bytes / (1024 * 1024)).toFixed(1)}MB) exceeds the 100MB limit.`
      );
    }

    // 1. Create S3 multipart upload session
    const { uploadId, s3Key, bucket, totalParts, partSizeBytes } =
      await initiateVideoMultipartUpload({
        userId,
        mimeType: mime_type,
        fileSizeBytes: file_size_bytes,
        originalFilename: original_filename,
      });

    // 2. Insert into videos table in initiated status
    const videoResult = await pool.query(
      `INSERT INTO videos (user_id, s3_key_raw, mime_type, file_size_bytes, original_filename, status)
       VALUES ($1, $2, $3, $4, $5, 'initiated')
       RETURNING id, user_id, s3_key_raw, mime_type, file_size_bytes, original_filename, status, created_at`,
      [userId, s3Key, mime_type, file_size_bytes || null, original_filename || null]
    );

    const video = videoResult.rows[0];

    // 3. Track upload state in video_uploads table
    await pool.query(
      `INSERT INTO video_uploads (video_id, s3_upload_id, s3_key, total_parts)
       VALUES ($1, $2, $3, $4)`,
      [video.id, uploadId, s3Key, totalParts]
    );

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          video_id: video.id,
          upload_id: uploadId,
          s3_key: s3Key,
          bucket,
          total_parts: totalParts,
          part_size_bytes: partSizeBytes,
          status: video.status,
        },
        "Video multipart upload initiated successfully."
      )
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 2. Get Presigned URLs for Video Parts
 * POST /api/v1/videos/part-urls
 */
export const getPartUrls = async (req, res, next) => {
  try {
    const { video_id, part_numbers } = req.body;
    const userId = req.user.id;

    if (!video_id) {
      throw new AppError(400, "Field 'video_id' is required.");
    }

    if (!part_numbers || !Array.isArray(part_numbers) || part_numbers.length === 0) {
      throw new AppError(400, "Field 'part_numbers' must be a non-empty array of numbers (e.g. [1, 2, 3]).");
    }

    // Verify video belongs to user and is currently in initiated state
    const uploadRes = await pool.query(
      `SELECT vu.s3_upload_id, vu.s3_key, v.status, v.user_id
       FROM video_uploads vu
       JOIN videos v ON vu.video_id = v.id
       WHERE vu.video_id = $1 AND v.user_id = $2`,
      [video_id, userId]
    );

    if (uploadRes.rowCount === 0) {
      throw new AppError(404, "Active video upload session not found or permission denied.");
    }

    const upload = uploadRes.rows[0];
    const parts = await getVideoPartUploadUrls({
      s3Key: upload.s3_key,
      uploadId: upload.s3_upload_id,
      partNumbers: part_numbers,
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        { parts },
        "Presigned part upload URLs generated successfully."
      )
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 3. Complete Video Multipart Upload & Queue Transcoding
 * POST /api/v1/videos/complete
 */
export const completeUpload = async (req, res, next) => {
  try {
    const { video_id, parts } = req.body;
    const userId = req.user.id;

    if (!video_id) {
      throw new AppError(400, "Field 'video_id' is required.");
    }

    if (!parts || !Array.isArray(parts) || parts.length === 0) {
      throw new AppError(400, "Field 'parts' is required and must contain PartNumber and ETag.");
    }

    // Verify upload session
    const uploadRes = await pool.query(
      `SELECT vu.s3_upload_id, vu.s3_key, v.*
       FROM video_uploads vu
       JOIN videos v ON vu.video_id = v.id
       WHERE vu.video_id = $1 AND v.user_id = $2`,
      [video_id, userId]
    );

    if (uploadRes.rowCount === 0) {
      throw new AppError(404, "Active video upload session not found or permission denied.");
    }

    const session = uploadRes.rows[0];

    // Complete S3 multipart upload
    await completeVideoMultipartUpload({
      s3Key: session.s3_key,
      uploadId: session.s3_upload_id,
      parts,
    });

    // Update status in PostgreSQL to 'uploaded'
    const updatedRes = await pool.query(
      `UPDATE videos
       SET status = 'uploaded', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [video_id]
    );

    const video = updatedRes.rows[0];

    // Clean up temporary video_uploads session
    await pool.query(`DELETE FROM video_uploads WHERE video_id = $1`, [video_id]);

    // Enqueue transcoding job into Redis video_processing queue
    const jobId = await enqueueJob("video_processing", {
      videoId: video.id,
      userId: video.user_id,
      s3KeyRaw: video.s3_key_raw,
      originalFilename: video.original_filename,
      mimeType: video.mime_type,
      fileSizeBytes: video.file_size_bytes,
    });

    console.log(`[VideoController] 🎬 Video ${video.id} completed upload; enqueued to video_processing (job: ${jobId})`);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          video_id: video.id,
          status: video.status,
          job_id: jobId,
        },
        "Video upload completed successfully. Transcoding queued."
      )
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 4. Abort Video Multipart Upload
 * POST /api/v1/videos/abort
 */
export const abortUpload = async (req, res, next) => {
  try {
    const { video_id } = req.body;
    const userId = req.user.id;

    if (!video_id) {
      throw new AppError(400, "Field 'video_id' is required.");
    }

    const uploadRes = await pool.query(
      `SELECT vu.s3_upload_id, vu.s3_key
       FROM video_uploads vu
       JOIN videos v ON vu.video_id = v.id
       WHERE vu.video_id = $1 AND v.user_id = $2`,
      [video_id, userId]
    );

    if (uploadRes.rowCount > 0) {
      const { s3_upload_id, s3_key } = uploadRes.rows[0];
      try {
        await abortVideoMultipartUpload({ s3Key: s3_key, uploadId: s3_upload_id });
      } catch (s3Err) {
        console.warn(`[VideoController] S3 abort error: ${s3Err.message}`);
      }

      await pool.query(
        `UPDATE videos SET status = 'failed', error_message = 'Upload aborted by client', updated_at = NOW() WHERE id = $1`,
        [video_id]
      );
      await pool.query(`DELETE FROM video_uploads WHERE video_id = $1`, [video_id]);
    }

    return res.status(200).json(
      new ApiResponse(200, { video_id }, "Video upload session aborted successfully.")
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 5. Get Video Status & Public URLs
 * GET /api/v1/videos/:id/status
 */
export const getVideoStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM videos WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      throw new AppError(404, "Video not found.");
    }

    const formatted = formatVideoResponse(result.rows[0]);
    return res.status(200).json(
      new ApiResponse(200, formatted, "Video status retrieved successfully.")
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 6. Get Video Details
 * GET /api/v1/videos/:id
 */
export const getVideoById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM videos WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      throw new AppError(404, "Video not found.");
    }

    const formatted = formatVideoResponse(result.rows[0]);
    return res.status(200).json(
      new ApiResponse(200, formatted, "Video details retrieved successfully.")
    );
  } catch (err) {
    next(err);
  }
};

/**
 * 7. Record Video View (Twitter/X Style: >= 3s consecutive watch with >= 50% visibility)
 * POST /api/v1/videos/:id/view
 */
export const recordVideoView = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE videos SET views_count = COALESCE(views_count, 0) + 1 WHERE id = $1 RETURNING views_count, post_id`,
      [id]
    );

    if (result.rowCount === 0) {
      throw new AppError(404, "Video not found.");
    }

    const postId = result.rows[0].post_id;
    let postViewsCount = null;
    if (postId) {
      const postRes = await pool.query(
        `UPDATE posts SET views_count = COALESCE(views_count, 0) + 1 WHERE id = $1 RETURNING views_count`,
        [postId]
      );
      if (postRes.rowCount > 0) {
        postViewsCount = postRes.rows[0].views_count;
      }
    }

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          video_views_count: result.rows[0].views_count,
          post_views_count: postViewsCount,
        },
        "Video view recorded successfully."
      )
    );
  } catch (err) {
    next(err);
  }
};


