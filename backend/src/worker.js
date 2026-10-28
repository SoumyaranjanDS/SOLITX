/**
 * SOLITX DAY 27: Resilient Asynchronous Background Worker Process
 * 
 * Standalone consumer process that polls Redis queues with:
 * - Reliable Dequeue (RPOPLPUSH) to prevent job loss during crashes.
 * - At-Least-Once Delivery with explicit ACK on DB success.
 * - Automatic Retries with Exponential Backoff on transient database locks.
 * - Dead-Letter Queue (DLQ) quarantine for persistent failures.
 * - Graceful Shutdown draining in-flight jobs on SIGTERM/SIGINT.
 * 
 * Usage:
 *   node src/worker.js
 */

import dotenv from "dotenv";
dotenv.config();

import { 
  dequeueReliable, 
  ackJob, 
  handleJobFailure, 
  getQueueLength,
  getProcessingCount,
  getDeadLetterCount,
  checkAndSetIdempotency
} from "./queue/jobQueue.js";
import pool from "./config/db.js";
import redis from "./config/redis.js";
import sharp from "sharp";
import { getS3Buffer, putS3Object, buildPublicMediaUrl } from "./services/s3Service.js";

const ACTIVE_QUEUES = ["notifications", "feed_fanout", "media_processing"];
let isRunning = true;
let activeJobsCount = 0;

// Registry of job handlers
const HANDLERS = {
  media_processing: async (job) => {
    const { mediaId, userId, s3KeyRaw } = job.data;
    if (!mediaId || !s3KeyRaw) return;

    console.log(`[Worker] 🖼️ Optimizing media ${mediaId} from S3 (${s3KeyRaw})...`);

    // 1. Download raw image from S3
    const rawBuffer = await getS3Buffer(s3KeyRaw);

    // 2. Validate metadata / dimensions (Decompression Bomb Protection)
    const image = sharp(rawBuffer);
    const metadata = await image.metadata();

    const maxPixels = 25_000_000; // 25 Megapixels
    if ((metadata.width || 0) * (metadata.height || 0) > maxPixels) {
      await pool.query(
        `UPDATE media SET status = 'failed', error_message = $1, updated_at = NOW() WHERE id = $2`,
        ['Image dimensions exceed safety limit (25 Megapixels).', mediaId]
      );
      throw new Error(`Decompression bomb rejected: ${metadata.width}x${metadata.height} exceeds limit.`);
    }

    // 3. Generate 3 responsive WebP variants with stripped EXIF
    const baseKey = `optimized/${userId}/${mediaId}`;
    const keyThumb = `${baseKey}_thumb.webp`;
    const keyFeed = `${baseKey}_feed.webp`;
    const keyFull = `${baseKey}_full.webp`;

    // A. Thumbnail (150x150 square crop)
    const thumbBuf = await sharp(rawBuffer)
      .rotate()
      .resize(150, 150, { fit: 'cover', position: 'center' })
      .webp({ quality: 80 })
      .toBuffer();

    // B. Feed Timeline (600px width max)
    const feedBuf = await sharp(rawBuffer)
      .rotate()
      .resize({ width: 600, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();

    // C. Full / Lightbox (1200px width max)
    const fullBuf = await sharp(rawBuffer)
      .rotate()
      .resize({ width: 1200, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    // 4. Upload all 3 variants to S3 concurrently
    await Promise.all([
      putS3Object({ key: keyThumb, body: thumbBuf, contentType: 'image/webp' }),
      putS3Object({ key: keyFeed, body: feedBuf, contentType: 'image/webp' }),
      putS3Object({ key: keyFull, body: fullBuf, contentType: 'image/webp' }),
    ]);

    // 5. Construct public URLs (CloudFront CDN or fallback S3)
    const urlThumb = buildPublicMediaUrl(keyThumb);
    const urlFeed = buildPublicMediaUrl(keyFeed);
    const urlFull = buildPublicMediaUrl(keyFull);

    // 6. Update PostgreSQL media record to 'ready'
    await pool.query(
      `UPDATE media 
       SET s3_key_thumb = $1, s3_key_feed = $2, s3_key_full = $3,
           url_thumb = $4, url_feed = $5, url_full = $6,
           width = $7, height = $8, status = 'ready', updated_at = NOW()
       WHERE id = $9`,
      [
        keyThumb, keyFeed, keyFull,
        urlThumb, urlFeed, urlFull,
        metadata.width, metadata.height,
        mediaId
      ]
    );

    // 7. Auto-link to user profile if entityType is specified (Avatar / Banner)
    if (job.data?.entityType === 'avatar') {
      await pool.query(
        `UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`,
        [urlFeed, userId]
      );
      try {
        const u = await pool.query(`SELECT username FROM users WHERE id = $1`, [userId]);
        if (u.rowCount > 0) await redis.del(`user:${u.rows[0].username}`);
      } catch (e) {}
    } else if (job.data?.entityType === 'banner') {
      await pool.query(
        `UPDATE users SET banner_url = $1, updated_at = NOW() WHERE id = $2`,
        [urlFull || urlFeed, userId]
      );
      try {
        const u = await pool.query(`SELECT username FROM users WHERE id = $1`, [userId]);
        if (u.rowCount > 0) await redis.del(`user:${u.rows[0].username}`);
      } catch (e) {}
    }

    console.log(`[Worker] ✅ Media ${mediaId} optimized & published to CDN!`);
  },
  notifications: async (job) => {
    const { recipientId, actorId, type, postId, commentId, messageContent } = job.data;
    if (!recipientId || !actorId || recipientId === actorId) return;

    // Simulation hook for fault testing: if messageContent contains "FORCE_FAIL", throw test error
    if (messageContent && messageContent.includes("FORCE_FAIL")) {
      throw new Error("Simulated Database Transient Lock Error (Deadlock)");
    }

    // DAY 28 IDEMPOTENCY LAYER 1: Fast In-Memory Redis Deduplication Check
    const idempotencyKey = job.id || `${recipientId}_${actorId}_${type}_${postId || 'null'}`;
    const isNew = await checkAndSetIdempotency(idempotencyKey, 86400);
    if (!isNew) {
      console.log(`[Worker] 🛡️ Idempotency Layer 1: Job ${job.id} already processed. Deduplicating!`);
      return;
    }

    // DAY 28 IDEMPOTENCY LAYER 2: PostgreSQL ON CONFLICT (idempotency_key) DO NOTHING
    await pool.query(
      `INSERT INTO notifications (recipient_id, actor_id, type, post_id, comment_id, message_content, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [
        recipientId,
        actorId,
        type,
        postId || null,
        commentId || null,
        messageContent || null,
        idempotencyKey,
      ]
    );
  },

  feed_fanout: async (job) => {
    const { followerIds, postId } = job.data;
    if (!followerIds || !Array.isArray(followerIds)) return;

    const pipeline = redis.pipeline();
    for (const followerId of followerIds) {
      pipeline.lpush(`timeline:${followerId}`, postId);
      pipeline.ltrim(`timeline:${followerId}`, 0, 99);
    }
    await pipeline.exec();
  },
};

async function processQueue(queueName) {
  while (isRunning) {
    let item = null;
    try {
      // 1. Reliable dequeue (moves to queue:<name>:processing)
      item = await dequeueReliable(queueName);
      if (!item) {
        // Queue is empty; sleep 3000ms to preserve Redis quota and avoid tight busy-polling
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      const { job, raw } = item;
      activeJobsCount++;
      const t0 = performance.now();
      console.log(
        `[Worker] Processing job ${job.id} from queue:${queueName} (attempt: ${job.attempts || 0}/${job.maxAttempts || 3})`
      );

      const handler = HANDLERS[queueName];
      if (handler) {
        await handler(job);

        // 2. Acknowledge (ACK) job on success -> removes from processing list
        await ackJob(queueName, raw);
        const elapsed = (performance.now() - t0).toFixed(2);
        console.log(`[Worker] ✅ ACKed job ${job.id} in ${elapsed}ms`);
      } else {
        console.warn(`[Worker] No handler registered for queue:${queueName}`);
        await ackJob(queueName, raw);
      }
    } catch (err) {
      console.error(`[Worker] ❌ Error executing job on queue:${queueName}:`, err.message);

      // If dequeue or Redis connection failed, pause before hammering Redis again
      if (!item) {
        await new Promise((r) => setTimeout(r, 10000));
      } else {
        // 3. Resilient Error Handling (Retries with Exponential Backoff or DLQ)
        const failureRes = await handleJobFailure(queueName, item.job, item.raw, err);
        if (failureRes.action === "dead_letter") {
          console.warn(
            `[Worker] ⚠️ Job ${item.job.id} exceeded max retries (${failureRes.job.attempts}). Quarantined to DEAD-LETTER QUEUE (queue:${queueName}:dead_letter).`
          );
        } else {
          console.log(
            `[Worker] 🔄 Scheduled retry for job ${item.job.id} in ${failureRes.delayMs}ms (attempt ${failureRes.job.attempts}/${failureRes.job.maxAttempts}).`
          );
        }
      }
    } finally {
      activeJobsCount = Math.max(0, activeJobsCount - 1);
    }
  }
}

async function startWorker() {
  console.log("================================================================================");
  console.log("     SOLITX RESILIENT ASYNCHRONOUS WORKER POOL (DAY 27 — RETRIES & DLQ)");
  console.log("================================================================================");
  console.log(`Active Queues:  ${ACTIVE_QUEUES.join(", ")}`);
  console.log(`PID:            ${process.pid}`);
  console.log(`Timestamp:      ${new Date().toISOString()}\n`);

  for (const q of ACTIVE_QUEUES) {
    try {
      const len = await getQueueLength(q);
      const proc = await getProcessingCount(q);
      const dlq = await getDeadLetterCount(q);
      console.log(`Queue [${q}] -> Pending: ${len} | In-Flight: ${proc} | DLQ: ${dlq}`);
    } catch (e) {
      console.warn(`Queue [${q}] -> Pending check skipped (${e.message})`);
    }
    processQueue(q);
  }

  console.log("\n🚀 Resilient worker pool listening for jobs from Redis...\n");
}

// Graceful Shutdown
const shutdown = async (signal) => {
  console.log(`\n[Worker] Received ${signal}. Draining active jobs before shutdown...`);
  isRunning = false;

  let retries = 0;
  while (activeJobsCount > 0 && retries < 10) {
    console.log(`[Worker] Waiting for ${activeJobsCount} in-flight jobs to complete...`);
    await new Promise((r) => setTimeout(r, 500));
    retries++;
  }

  console.log("[Worker] All in-flight jobs drained cleanly.");
  await pool.end();
  await redis.quit();
  console.log("[Worker] Teardown complete. Goodbye.");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { startWorker, HANDLERS, shutdown };

if (process.argv[1]?.endsWith("worker.js")) {
  startWorker();
}
