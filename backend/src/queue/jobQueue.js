/**
 * SOLITX DAY 25: Redis-Backed Asynchronous Job Queue
 * 
 * Provides atomic Producer-Consumer queue primitives using Upstash Redis.
 * - Producer: LPUSH jobs to queue:name in < 5ms.
 * - Consumer: RPOP / BRPOP jobs for asynchronous processing.
 * - Inspection: LLEN / LRANGE for queue health and depth monitoring.
 */

import redis from "../config/redis.js";

/**
 * Enqueue a job into Redis (Producer)
 * @param {string} queueName - Name of the target queue (e.g., 'notifications', 'fanout')
 * @param {object} payload - Job payload data
 * @param {object} options - Optional job metadata (maxAttempts, priority)
 * @returns {Promise<string>} - Generated Job ID
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
 * Dequeue a single pending job (Consumer non-blocking)
 * @param {string} queueName
 * @returns {Promise<object|null>} - Parsed job envelope or null if empty
 */
export const dequeueJob = async (queueName) => {
  const raw = await redis.rpop(`queue:${queueName}`);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[Queue] Corrupted payload in queue:${queueName}:`, raw);
    return null;
  }
};

/**
 * Blocking Dequeue (Consumer waits up to timeoutSeconds)
 * @param {string} queueName 
 * @param {number} timeoutSeconds (default 2s)
 * @returns {Promise<object|null>}
 */
export const dequeueBlocking = async (queueName, timeoutSeconds = 2) => {
  try {
    const res = await redis.brpop(`queue:${queueName}`, timeoutSeconds);
    if (!res || !res[1]) return null;
    return JSON.parse(res[1]);
  } catch (err) {
    console.error(`[Queue] BRPOP error on queue:${queueName}:`, err.message);
    return null;
  }
};

/**
 * Get current pending queue length
 * @param {string} queueName
 * @returns {Promise<number>}
 */
export const getQueueLength = async (queueName) => {
  return await redis.llen(`queue:${queueName}`);
};

/**
 * Peek recent jobs in the queue without dequeuing
 * @param {string} queueName 
 * @param {number} start 
 * @param {number} stop 
 * @returns {Promise<Array<object>>}
 */
export const peekQueue = async (queueName, start = 0, stop = 9) => {
  const rawItems = await redis.lrange(`queue:${queueName}`, start, stop);
  return rawItems.map((item) => {
    try {
      return JSON.parse(item);
    } catch {
      return { raw: item };
    }
  });
};

/**
 * Clear all pending jobs in a queue (useful for testing and teardown)
 * @param {string} queueName 
 */
export const clearQueue = async (queueName) => {
  await redis.del(`queue:${queueName}`);
};
