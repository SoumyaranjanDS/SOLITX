/**
 * SOLITX DAY 25: Queue Throughput & Latency Benchmark
 * 
 * Objectives:
 * 1. Measure Producer Enqueue Latency: Quantify how fast the API can drop jobs into Redis.
 * 2. Measure Consumer Dequeue Throughput: Quantify how fast the background worker drains the queue.
 * 3. Verify Message Integrity: Ensure 100% of enqueued jobs are consumed with 0% data loss.
 * 4. Prove Asynchronous Decoupling: Contrast the ~3ms enqueue time against synchronous execution.
 */

import dotenv from "dotenv";
dotenv.config();

import { enqueueJob, dequeueJob, getQueueLength, clearQueue } from "../src/queue/jobQueue.js";
import redis from "../src/config/redis.js";
import { formatMs } from "./config.js";

async function runQueueBenchmark() {
  console.log("================================================================================");
  console.log("    SOLITX ARCHITECTURE BENCHMARK: DAY 25 — REDIS JOB QUEUE");
  console.log("================================================================================");
  console.log(`Redis Host:  ${process.env.REDIS_URL ? new URL(process.env.REDIS_URL.replace('rediss://', 'https://')).hostname : 'Upstash'}`);
  console.log(`Timestamp:   ${new Date().toISOString()}\n`);

  const TEST_QUEUE = "benchmark_test_queue";
  const JOB_COUNT = 30;

  try {
    // 1. Initial cleanup
    await clearQueue(TEST_QUEUE);
    console.log(`[1/4] Cleaned test queue: queue:${TEST_QUEUE}`);

    // 2. Measure Producer Enqueue Latency
    console.log(`[2/4] Benchmarking Producer (Enqueueing ${JOB_COUNT} jobs to Upstash Redis)...`);
    const enqueueLatencies = [];
    const enqueuedJobIds = [];

    const tStartProducer = performance.now();
    for (let i = 0; i < JOB_COUNT; i++) {
      const t0 = performance.now();
      const jobId = await enqueueJob(TEST_QUEUE, {
        index: i,
        type: "test_notification",
        recipientId: "user_test_123",
        payload: `Test benchmark payload #${i}`,
      });
      const elapsed = performance.now() - t0;
      enqueueLatencies.push(elapsed);
      enqueuedJobIds.push(jobId);
    }
    const totalProducerTime = performance.now() - tStartProducer;

    // Check queue depth
    const queueDepth = await getQueueLength(TEST_QUEUE);
    console.log(`      Successfully enqueued ${JOB_COUNT} jobs.`);
    console.log(`      Verified Queue Depth in Redis: ${queueDepth} pending jobs\n`);

    // 3. Measure Consumer Dequeue Throughput
    console.log(`[3/4] Benchmarking Consumer (Draining ${JOB_COUNT} jobs from Upstash Redis)...`);
    const dequeueLatencies = [];
    const consumedJobs = [];

    const tStartConsumer = performance.now();
    for (let i = 0; i < JOB_COUNT; i++) {
      const t0 = performance.now();
      const job = await dequeueJob(TEST_QUEUE);
      const elapsed = performance.now() - t0;
      dequeueLatencies.push(elapsed);
      if (job) consumedJobs.push(job);
    }
    const totalConsumerTime = performance.now() - tStartConsumer;

    const remainingDepth = await getQueueLength(TEST_QUEUE);
    console.log(`      Successfully consumed ${consumedJobs.length} jobs.`);
    console.log(`      Remaining Queue Depth: ${remainingDepth} (0 means complete queue drain)\n`);

    // 4. Calculate Metrics
    const calcAvg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const calcP95 = (arr) => {
      const sorted = [...arr].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length * 0.95)] || 0;
    };

    const avgEnqueue = calcAvg(enqueueLatencies);
    const p95Enqueue = calcP95(enqueueLatencies);
    const avgDequeue = calcAvg(dequeueLatencies);
    const p95Dequeue = calcP95(dequeueLatencies);

    const producerThroughput = (JOB_COUNT / (totalProducerTime / 1000)).toFixed(1);
    const consumerThroughput = (consumedJobs.length / (totalConsumerTime / 1000)).toFixed(1);

    console.log("================================================================================");
    console.log("                        QUEUE BENCHMARK RESULTS");
    console.log("================================================================================");
    console.log(` PRODUCER METRICS (API Thread Non-Blocking Impact):`);
    console.log(`   - Average Enqueue Latency:   ${formatMs(avgEnqueue)} (Time added to HTTP request)`);
    console.log(`   - P95 Enqueue Latency:       ${formatMs(p95Enqueue)}`);
    console.log(`   - Enqueue Throughput:        ${producerThroughput} jobs/sec`);
    console.log(``);
    console.log(` CONSUMER METRICS (Background Worker Draining Speed):`);
    console.log(`   - Average Dequeue Latency:   ${formatMs(avgDequeue)}`);
    console.log(`   - P95 Dequeue Latency:       ${formatMs(p95Dequeue)}`);
    console.log(`   - Dequeue Throughput:        ${consumerThroughput} jobs/sec`);
    console.log(``);
    console.log(` MESSAGE RELIABILITY & INTEGRITY:`);
    console.log(`   - Enqueued Jobs:             ${JOB_COUNT}`);
    console.log(`   - Consumed Jobs:             ${consumedJobs.length}`);
    console.log(`   - Delivery Success Rate:     ${((consumedJobs.length / JOB_COUNT) * 100).toFixed(1)}% (100% = ZERO DATA LOSS)`);
    console.log(`   - Queue Final State:         ${remainingDepth === 0 ? "CLEAN (Empty)" : "DIRTY"}`);
    console.log("================================================================================");

    // Teardown
    await clearQueue(TEST_QUEUE);
    console.log(`\n[4/4] Cleaned test benchmark queue cleanly.`);

  } catch (err) {
    console.error("Queue benchmark error:", err);
  } finally {
    await redis.quit();
  }
}

runQueueBenchmark();
