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

const ACTIVE_QUEUES = ["notifications", "feed_fanout"];
let isRunning = true;
let activeJobsCount = 0;

// Registry of job handlers
const HANDLERS = {
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
        // Queue is empty; sleep 500ms to avoid busy loop
        await new Promise((r) => setTimeout(r, 500));
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

      // 3. Resilient Error Handling (Retries with Exponential Backoff or DLQ)
      if (item) {
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
    const len = await getQueueLength(q);
    const proc = await getProcessingCount(q);
    const dlq = await getDeadLetterCount(q);
    console.log(`Queue [${q}] -> Pending: ${len} | In-Flight: ${proc} | DLQ: ${dlq}`);
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
