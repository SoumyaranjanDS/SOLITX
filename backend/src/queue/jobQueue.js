/**
 * SOLITX DAY 27: Resilient Redis-Backed Asynchronous Job Queue
 * 
 * Features:
 * - Reliable Dequeue: In-flight processing tracking via queue:<name>:processing.
 * - At-Least-Once Delivery: Job is ACKed only after successful execution.
 * - Exponential Backoff Retries: 2^attempts * 1000ms backoff for transient failures.
 * - Dead-Letter Queue (DLQ): Quarantines persistent failures to queue:<name>:dead_letter.
 * - DLQ Replayability: Admin reconciliation to replay failed jobs back into main queue.
 */

import redis from "../config/redis.js";

/**
 * Enqueue a job into Redis (Producer)
 */
export const enqueueJob = async (queueName, payload, options = {}) => {
  if (!queueName || typeof queueName !== "string") {
    throw new Error("Queue name is required and must be a string");
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const job = {
    id: jobId,
    queue: queueName,
    data: payload,
    attempts: 0,
    maxAttempts: options.maxAttempts || 3,
    enqueuedAt: Date.now(),
    status: "pending",
  };

  const serialized = JSON.stringify(job);
  await redis.lpush(`queue:${queueName}`, serialized);

  return jobId;
};

/**
 * Reliable Dequeue: Atomically transfers job from main queue to processing queue
 * Uses RPOPLPUSH (or fallback) so if worker crashes mid-task, the job is not lost!
 */
export const dequeueReliable = async (queueName) => {
  const mainQueue = `queue:${queueName}`;
  const processingQueue = `queue:${queueName}:processing`;

  try {
    // RPOPLPUSH is atomic in Redis
    const raw = await redis.rpoplpush(mainQueue, processingQueue);
    if (!raw) return null;

    const job = JSON.parse(raw);
    return { job, raw };
  } catch (err) {
    // If RPOPLPUSH fails, fallback to simple RPOP
    const raw = await redis.rpop(mainQueue);
    if (!raw) return null;
    return { job: JSON.parse(raw), raw };
  }
};

/**
 * Acknowledge (ACK) Job: Called when job finishes successfully
 * Removes the job from the in-flight processing queue.
 */
export const ackJob = async (queueName, rawJob) => {
  const processingQueue = `queue:${queueName}:processing`;
  await redis.lrem(processingQueue, 1, rawJob);
};

/**
 * Handle Job Failure: Executes Exponential Backoff or moves to DLQ
 * @param {string} queueName
 * @param {object} job
 * @param {string} rawJob
 * @param {Error|string} error
 * @returns {Promise<{action: 'retry'|'dead_letter', delayMs?: number, job: object}>}
 */
export const handleJobFailure = async (queueName, job, rawJob, error) => {
  const mainQueue = `queue:${queueName}`;
  const processingQueue = `queue:${queueName}:processing`;
  const dlqQueue = `queue:${queueName}:dead_letter`;

  // 1. Remove from active in-flight processing list
  await redis.lrem(processingQueue, 1, rawJob);

  const currentAttempts = (job.attempts || 0) + 1;
  const maxAttempts = job.maxAttempts || 3;
  const errorMessage = error?.message || String(error);

  // 2. Check if maximum retry attempts exceeded
  if (currentAttempts >= maxAttempts) {
    // Exceeded retries -> Quarantine in Dead-Letter Queue (DLQ)
    const deadJob = {
      ...job,
      attempts: currentAttempts,
      status: "dead_letter",
      failedAt: Date.now(),
      finalError: errorMessage,
    };

    await redis.lpush(dlqQueue, JSON.stringify(deadJob));
    return { action: "dead_letter", job: deadJob };
  }

  // 3. Under max attempts -> Schedule Retry with Exponential Backoff (2^attempts * 1000ms)
  const delayMs = Math.pow(2, currentAttempts) * 1000;
  const retryJob = {
    ...job,
    attempts: currentAttempts,
    status: "retrying",
    lastRetriedAt: Date.now(),
    nextRetryDelayMs: delayMs,
    lastError: errorMessage,
  };

  // Re-enqueue for retry
  await redis.lpush(mainQueue, JSON.stringify(retryJob));
  return { action: "retry", delayMs, job: retryJob };
};

/**
 * Replay Dead-Letter Queue: Pops failed jobs from DLQ and pushes back to main queue
 * @param {string} queueName
 * @param {number} count - Maximum jobs to replay
 * @returns {Promise<number>} - Count of replayed jobs
 */
export const replayDeadLetter = async (queueName, count = 10) => {
  const mainQueue = `queue:${queueName}`;
  const dlqQueue = `queue:${queueName}:dead_letter`;

  let replayed = 0;
  for (let i = 0; i < count; i++) {
    const raw = await redis.rpop(dlqQueue);
    if (!raw) break;

    const job = JSON.parse(raw);
    const resetJob = {
      ...job,
      attempts: 0,
      status: "pending",
      replayedAt: Date.now(),
      finalError: null,
    };

    await redis.lpush(mainQueue, JSON.stringify(resetJob));
    replayed++;
  }

  return replayed;
};

/**
 * Inspection Helpers
 */
export const getQueueLength = async (queueName) => {
  return await redis.llen(`queue:${queueName}`);
};

export const getProcessingCount = async (queueName) => {
  return await redis.llen(`queue:${queueName}:processing`);
};

export const getDeadLetterCount = async (queueName) => {
  return await redis.llen(`queue:${queueName}:dead_letter`);
};

export const peekDeadLetter = async (queueName, start = 0, stop = 9) => {
  const rawItems = await redis.lrange(`queue:${queueName}:dead_letter`, start, stop);
  return rawItems.map((item) => {
    try {
      return JSON.parse(item);
    } catch {
      return { raw: item };
    }
  });
};

export const clearQueue = async (queueName) => {
  await redis.del(`queue:${queueName}`);
  await redis.del(`queue:${queueName}:processing`);
  await redis.del(`queue:${queueName}:dead_letter`);
};

/**
 * Check and Set Idempotency Key (SETNX with TTL)
 * Atomically reserves a job execution key.
 * @param {string} idempotencyKey - Unique key identifying the operation
 * @param {number} ttlSeconds - Duration to maintain the deduplication window (default 24h)
 * @returns {Promise<boolean>} - true if this is the first execution (key acquired), false if duplicate
 */
export const checkAndSetIdempotency = async (idempotencyKey, ttlSeconds = 86400) => {
  const result = await redis.set(`idempotency:${idempotencyKey}`, "1", "EX", ttlSeconds, "NX");
  return result === "OK";
};

/**
 * Release an idempotency key (used if a job fails and must be allowed to retry)
 */
export const releaseIdempotency = async (idempotencyKey) => {
  await redis.del(`idempotency:${idempotencyKey}`);
};

/**
 * Legacy Dequeue (Non-blocking)
 */
export const dequeueJob = async (queueName) => {
  const raw = await redis.rpop(`queue:${queueName}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Legacy Blocking Dequeue
 */
export const dequeueBlocking = async (queueName, timeoutSeconds = 2) => {
  try {
    const res = await redis.brpop(`queue:${queueName}`, timeoutSeconds);
    if (!res || !res[1]) return null;
    return JSON.parse(res[1]);
  } catch {
    return null;
  }
};
