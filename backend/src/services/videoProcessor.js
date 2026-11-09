import fs from "fs";
import path from "path";
import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import pool from "../config/db.js";
import redis from "../config/redis.js";
import {
  downloadS3FileToLocal,
  uploadLocalFileToS3,
  buildPublicMediaUrl,
} from "./s3Service.js";

const execFileAsync = promisify(execFile);

const LOCK_KEY = "lock:video_transcoding";
const LOCK_TTL_MS = 600000; // 10 minutes TTL to prevent deadlocks
const MAX_DURATION_SECONDS = 120.5; // Max 120 seconds duration

/**
 * Acquire Redis distributed lock for video transcoding
 */
async function acquireTranscodingLock(videoId) {
  const result = await redis.set(LOCK_KEY, videoId, "PX", LOCK_TTL_MS, "NX");
  return result === "OK";
}

/**
 * Release Redis distributed lock if held by this videoId
 */
async function releaseTranscodingLock(videoId) {
  try {
    const current = await redis.get(LOCK_KEY);
    if (current === videoId) {
      await redis.del(LOCK_KEY);
    }
  } catch (err) {
    console.warn(`[VideoProcessor] Warning releasing lock: ${err.message}`);
  }
}

/**
 * Runs ffprobe on a local video file to extract duration, width, and height.
 */
async function probeVideo(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,duration,r_frame_rate,bit_rate",
    "-show_entries",
    "format=duration,size,bit_rate",
    "-of",
    "json",
    filePath,
  ]);

  const probe = JSON.parse(stdout);
  const stream = probe.streams?.[0] || {};
  const format = probe.format || {};

  const durationStr = format.duration || stream.duration;
  const duration = durationStr ? parseFloat(durationStr) : 0;
  const width = stream.width ? parseInt(stream.width, 10) : 0;
  const height = stream.height ? parseInt(stream.height, 10) : 0;

  return { duration, width, height };
}

/**
 * Main Video Processing Handler
 * 1. Acquire single-concurrency lock.
 * 2. Download raw video from S3.
 * 3. Inspect metadata & enforce 120-second max duration limit.
 * 4. Generate thumbnail image.
 * 5. Generate optimized downloadable MP4 (+faststart).
 * 6. Generate adaptive HLS streams & master.m3u8 playlist.
 * 7. Upload all processed assets to S3.
 * 8. Update PostgreSQL videos table to 'ready'.
 * 9. Clean up temporary files on disk.
 */
export async function processVideoJob(jobData) {
  const { videoId, userId, s3KeyRaw } = jobData;
  if (!videoId || !userId || !s3KeyRaw) {
    throw new Error("Missing required fields in video_processing job data.");
  }

  console.log(`[VideoProcessor] 🎥 Starting processing for video ${videoId} (user: ${userId})...`);

  // 1. Concurrency control: AWS t3.micro 1GB RAM safety lock
  let lockAcquired = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    lockAcquired = await acquireTranscodingLock(videoId);
    if (lockAcquired) break;
    console.log(`[VideoProcessor] Another transcoding job in progress. Waiting 5s (attempt ${attempt + 1}/30)...`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  if (!lockAcquired) {
    throw new Error("Transcoding worker busy. Postponing job for next retry cycle.");
  }

  const workDir = path.join(os.tmpdir(), "solitx-videos", videoId);
  const hlsDir = path.join(workDir, "hls");

  try {
    // 2. Prepare workspace directory
    await fs.promises.mkdir(hlsDir, { recursive: true });
    const rawPath = path.join(workDir, "raw.mp4");
    const thumbPath = path.join(workDir, "thumbnail.jpg");
    const downloadMp4Path = path.join(workDir, "download.mp4");

    // 3. Download raw object from S3
    console.log(`[VideoProcessor] ⬇️ Downloading raw video from S3: ${s3KeyRaw}`);
    await downloadS3FileToLocal(s3KeyRaw, rawPath);

    // 4. Probe video metadata
    const { duration, width, height } = await probeVideo(rawPath);
    console.log(`[VideoProcessor] 📐 Probed video: ${width}x${height}, duration: ${duration.toFixed(2)}s`);

    // Enforce 120-second duration limit
    if (duration > MAX_DURATION_SECONDS) {
      const errorMsg = `Video duration (${duration.toFixed(1)}s) exceeds the maximum allowed limit of 120 seconds.`;
      await pool.query(
        `UPDATE videos SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
        [errorMsg, videoId]
      );
      throw new Error(errorMsg);
    }

    // Update status to processing with detected dimensions
    await pool.query(
      `UPDATE videos
       SET status = 'processing', duration_seconds = $1, width = $2, height = $3, updated_at = NOW()
       WHERE id = $4`,
      [duration, width, height, videoId]
    );

    // 5. Generate Thumbnail (1.0s or 0.0s for very short clips)
    const thumbTime = duration >= 1.0 ? "00:00:01.000" : "00:00:00.000";
    console.log(`[VideoProcessor] 🖼️ Generating thumbnail at ${thumbTime}...`);
    await execFileAsync("ffmpeg", [
      "-y",
      "-ss",
      thumbTime,
      "-i",
      rawPath,
      "-vframes",
      "1",
      "-q:v",
      "2",
      thumbPath,
    ]);

    // 6. Generate Progressive Downloadable MP4 with +faststart
    // Caps resolution at 720p or keeps original if smaller
    console.log(`[VideoProcessor] 📦 Generating downloadable MP4...`);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      rawPath,
      "-vf",
      "scale='min(1280,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-threads",
      "1",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      downloadMp4Path,
    ]);

    // 7. Generate HLS Multi-Bitrate Streams
    // Adapt tiers based on source height (never upscale)
    console.log(`[VideoProcessor] 📺 Transcoding HLS stream tiers...`);
    const masterTiers = [];

    // Tier 1: 1080p (if source height >= 1080)
    if (height >= 1080) {
      console.log(`[VideoProcessor] Transcoding 1080p HLS tier...`);
      await execFileAsync("ffmpeg", [
        "-y",
        "-i",
        rawPath,
        "-vf",
        "scale='min(1920,iw)':-2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "21",
        "-threads",
        "1",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-hls_time",
        "4",
        "-hls_playlist_type",
        "vod",
        "-hls_segment_filename",
        path.join(hlsDir, "1080p_%03d.ts"),
        path.join(hlsDir, "1080p.m3u8"),
      ]);
      masterTiers.push({
        bandwidth: 3500000,
        resolution: "1920x1080",
        filename: "1080p.m3u8",
      });
    }

    // Tier 2: 720p (if source height >= 720)
    if (height >= 720) {
      console.log(`[VideoProcessor] Transcoding 720p HLS tier...`);
      await execFileAsync("ffmpeg", [
        "-y",
        "-i",
        rawPath,
        "-vf",
        "scale='min(1280,iw)':-2",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "23",
        "-threads",
        "1",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-hls_time",
        "4",
        "-hls_playlist_type",
        "vod",
        "-hls_segment_filename",
        path.join(hlsDir, "720p_%03d.ts"),
        path.join(hlsDir, "720p.m3u8"),
      ]);
      masterTiers.push({
        bandwidth: 2200000,
        resolution: "1280x720",
        filename: "720p.m3u8",
      });
    }

    // Tier 3: 480p (always generated as base tier)
    console.log(`[VideoProcessor] Transcoding 480p HLS tier...`);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      rawPath,
      "-vf",
      "scale='min(854,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "26",
      "-threads",
      "1",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-hls_time",
      "4",
      "-hls_playlist_type",
      "vod",
      "-hls_segment_filename",
      path.join(hlsDir, "480p_%03d.ts"),
      path.join(hlsDir, "480p.m3u8"),
    ]);
    masterTiers.push({
      bandwidth: 1000000,
      resolution: "854x480",
      filename: "480p.m3u8",
    });

    // Tier 4: 360p (low bandwidth fallback)
    console.log(`[VideoProcessor] Transcoding 360p HLS tier...`);
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      rawPath,
      "-vf",
      "scale='min(640,iw)':-2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "28",
      "-threads",
      "1",
      "-c:a",
      "aac",
      "-b:a",
      "64k",
      "-hls_time",
      "4",
      "-hls_playlist_type",
      "vod",
      "-hls_segment_filename",
      path.join(hlsDir, "360p_%03d.ts"),
      path.join(hlsDir, "360p.m3u8"),
    ]);
    masterTiers.push({
      bandwidth: 600000,
      resolution: "640x360",
      filename: "360p.m3u8",
    });

    // 8. Generate Master HLS Playlist (master.m3u8)
    const masterPlaylistContent = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      ...masterTiers.flatMap((tier) => [
        `#EXT-X-STREAM-INF:BANDWIDTH=${tier.bandwidth},RESOLUTION=${tier.resolution}`,
        tier.filename,
      ]),
    ].join("\n");

    const masterPath = path.join(hlsDir, "master.m3u8");
    await fs.promises.writeFile(masterPath, masterPlaylistContent, "utf8");

    // 9. Upload all processed assets to S3
    const s3BasePrefix = `processed/${userId}/${videoId}`;
    const s3ThumbKey = `${s3BasePrefix}/thumbnail.jpg`;
    const s3DownloadKey = `${s3BasePrefix}/download.mp4`;
    const s3HlsMasterKey = `${s3BasePrefix}/hls/master.m3u8`;

    console.log(`[VideoProcessor] ☁️ Uploading thumbnail & download MP4 to S3...`);
    await uploadLocalFileToS3(thumbPath, s3ThumbKey, "image/jpeg");
    await uploadLocalFileToS3(downloadMp4Path, s3DownloadKey, "video/mp4");

    // Upload all HLS files
    const hlsFiles = await fs.promises.readdir(hlsDir);
    console.log(`[VideoProcessor] ☁️ Uploading ${hlsFiles.length} HLS files to S3...`);
    for (const file of hlsFiles) {
      const filePath = path.join(hlsDir, file);
      const s3Key = `${s3BasePrefix}/hls/${file}`;
      let contentType = "application/octet-stream";
      let cacheControl = "public, max-age=31536000, immutable";

      if (file.endsWith(".m3u8")) {
        contentType = "application/vnd.apple.mpegurl";
        cacheControl = "public, max-age=3600";
      } else if (file.endsWith(".ts")) {
        contentType = "video/mp2t";
        cacheControl = "public, max-age=31536000, immutable";
      }

      await uploadLocalFileToS3(filePath, s3Key, contentType, cacheControl);
    }

    // 10. Update PostgreSQL videos record to 'ready'
    await pool.query(
      `UPDATE videos
       SET status = 'ready',
           thumbnail_key = $1,
           download_key = $2,
           hls_master_key = $3,
           duration_seconds = $4,
           width = $5,
           height = $6,
           updated_at = NOW()
       WHERE id = $7`,
      [s3ThumbKey, s3DownloadKey, s3HlsMasterKey, duration, width, height, videoId]
    );

    console.log(`[VideoProcessor] ✅ Video ${videoId} successfully transcoded & ready!`);
  } catch (err) {
    console.error(`[VideoProcessor] ❌ Video processing error for ${videoId}:`, err);
    try {
      await pool.query(
        `UPDATE videos SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
        [err.message.substring(0, 500), videoId]
      );
    } catch (dbErr) {
      console.warn(`[VideoProcessor] Failed to update video failure status: ${dbErr.message}`);
    }
    throw err;
  } finally {
    // 11. Cleanup temp directory and release lock
    try {
      if (fs.existsSync(workDir)) {
        await fs.promises.rm(workDir, { recursive: true, force: true });
        console.log(`[VideoProcessor] 🧹 Cleaned up temporary files at ${workDir}`);
      }
    } catch (cleanupErr) {
      console.warn(`[VideoProcessor] Temporary cleanup warning: ${cleanupErr.message}`);
    }
    await releaseTranscodingLock(videoId);
  }
}
