/**
 * SOLITX DAY 25: Asynchronous Background Worker Process
 *
 * Standalone consumer process that polls Redis queues and processes jobs
 * completely detached from the user-facing Express HTTP loop.
 *
 * Usage:
 *   node src/worker.js
 */

import dotenv from "dotenv";
dotenv.config();

import { dequeueBlocking, getQueueLength } from "./queue/jobQueue.js";
import pool from "./config/db.js";
import redis from "./config/redis.js";

const ACTIVE_QUEUES = ["notifications", "feed_fanout"];
let isRunning = true;
let activeJobsCount = 0;

// Registry of job handlers
const HANDLERS = {
  notifications: async (job) => {
    const { recipientId, actorId, type, postId, commentId, messageContent } =
      job.data;
    if (!recipientId || !actorId || recipientId === actorId) return;

    await pool.query(
      `INSERT INTO notifications (recipient_id, actor_id, type, post_id, comment_id, message_content)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        recipientId,
        actorId,
        type,
        postId || null,
        commentId || null,
        messageContent || null,
      ],
    );
  },

  feed_fanout: async (job) => {
    const { followerIds, postId } = job.data;
    if (!followerIds || !Array.isArray(followerIds)) return;

    // Push post ID into each follower's cached timeline list in Redis
    const pipeline = redis.pipeline();
    for (const followerId of followerIds) {
      pipeline.lpush(`timeline:${followerId}`, postId);
      pipeline.ltrim(`timeline:${followerId}`, 0, 99); // Keep newest 100
    }
    await pipeline.exec();
  },
};

async function processQueue(queueName) {
  while (isRunning) {
    try {
      // Blocking wait for 2 seconds (zero CPU spinning when idle)
      const job = await dequeueBlocking(queueName, 2);
      if (!job) continue;

      activeJobsCount++;
      const t0 = performance.now();
      console.log(
        `[Worker] Received job ${job.id} from queue:${queueName} (type: ${job.data?.type || "general"})`,
      );

      const handler = HANDLERS[queueName];
      if (handler) {
        await handler(job);
        const elapsed = (performance.now() - t0).toFixed(2);
        console.log(`[Worker] Completed job ${job.id} in ${elapsed}ms`);
      } else {
        console.warn(`[Worker] No handler registered for queue:${queueName}`);
      }
    } catch (err) {
      console.error(
        `[Worker] Error processing queue:${queueName}:`,
        err.message,
      );
    } finally {
      activeJobsCount = Math.max(0, activeJobsCount - 1);
    }
  }
}

async function startWorker() {
  console.log(
    "================================================================================",
  );
  console.log("       SOLITX ASYNCHRONOUS BACKGROUND WORKER POOL (DAY 25)");
  console.log(
    "================================================================================",
  );
  console.log(`Active Queues:  ${ACTIVE_QUEUES.join(", ")}`);
  console.log(`PID:            ${process.pid}`);
  console.log(`Timestamp:      ${new Date().toISOString()}\n`);

  for (const q of ACTIVE_QUEUES) {
    const len = await getQueueLength(q);
    console.log(`Queue [${q}] initial depth: ${len} pending jobs`);
    // Launch an async worker loop for each queue
    processQueue(q);
  }

  console.log("\n🚀 Worker pool listening for incoming jobs from Redis...\n");
}

// Graceful Shutdown
const shutdown = async (signal) => {
  console.log(
    `\n[Worker] Received ${signal}. Draining active jobs before shutdown...`,
  );
  isRunning = false;

  let retries = 0;
  while (activeJobsCount > 0 && retries < 10) {
    console.log(
      `[Worker] Waiting for ${activeJobsCount} in-flight jobs to complete...`,
    );
    await new Promise((r) => setTimeout(r, 500));
    retries++;
  }

  console.log(
    "[Worker] All workers drained. Closing database and Redis connections.",
  );
  await pool.end();
  await redis.quit();
  console.log("[Worker] Clean teardown complete. Goodbye.");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Export startWorker for programmatic test harnesses, or run directly if invoked as script
export { startWorker, HANDLERS, shutdown };

if (process.argv[1]?.endsWith("worker.js")) {
  startWorker();
}
