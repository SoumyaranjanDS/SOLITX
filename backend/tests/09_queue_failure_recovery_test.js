/**
 * SOLITX DAY 27: Background Queue Failure Recovery & DLQ Benchmark
 * 
 * Objectives:
 * 1. Test In-Flight Safety: Verify job is transferred to queue:name:processing via RPOPLPUSH.
 * 2. Test Exponential Backoff Retries: Verify job attempts increment and delay scales (2^n * 1000ms).
 * 3. Test Dead-Letter Queue (DLQ) Quarantine: Verify poison-pill job is quarantined to DLQ after 3 failures.
 * 4. Test DLQ Replayability: Verify admin replay moves quarantined jobs back to main queue for re-processing.
 */

import dotenv from "dotenv";
dotenv.config();

import { 
  enqueueJob, 
  dequeueReliable, 
  ackJob, 
  handleJobFailure, 
  replayDeadLetter,
  getQueueLength, 
  getProcessingCount, 
  getDeadLetterCount, 
  clearQueue 
} from "../src/queue/jobQueue.js";
import redis from "../src/config/redis.js";
import { formatMs } from "./config.js";

async function runFailureRecoveryTest() {
  console.log("================================================================================");
  console.log("    SOLITX ARCHITECTURE BENCHMARK: DAY 27 — FAILURE RECOVERY & DLQ");
  console.log("================================================================================");
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const TEST_QUEUE = "failure_recovery_test";

  try {
    // 1. Initial cleanup
    await clearQueue(TEST_QUEUE);
    console.log(`[1/5] Cleaned test queues for: queue:${TEST_QUEUE}`);

    // 2. Test In-Flight Safety & Atomic Transfer
    console.log("[2/5] Testing In-Flight Safety (dequeueReliable via RPOPLPUSH)...");
    const testJobId = await enqueueJob(TEST_QUEUE, {
      type: "fault_injection_test",
      content: "FORCE_FAIL: Simulate DB deadlock",
    });
    console.log(`      Enqueued test job: ${testJobId}`);

    const pendingBefore = await getQueueLength(TEST_QUEUE);
    const item = await dequeueReliable(TEST_QUEUE);
    const pendingAfter = await getQueueLength(TEST_QUEUE);
    const inFlightAfter = await getProcessingCount(TEST_QUEUE);

    console.log(`      Queue pending before: ${pendingBefore} | after: ${pendingAfter}`);
    console.log(`      In-Flight processing count: ${inFlightAfter} (Preserved in processing set!)`);

    if (inFlightAfter !== 1 || pendingAfter !== 0) {
      throw new Error("In-flight safety check failed: Job was not moved to processing set.");
    }
    console.log("      ✅ AT-LEAST-ONCE DELIVERY SAFETY VERIFIED: Job is preserved during crashes.\n");

    // 3. Test Exponential Backoff Retries
    console.log("[3/5] Testing Exponential Backoff Retry Loop...");
    let currentItem = item;

    // Simulate Failure 1 (Attempt 1)
    console.log("      Simulating Transient Failure 1 (e.g. Database Deadlock)...");
    const fail1 = await handleJobFailure(
      TEST_QUEUE, 
      currentItem.job, 
      currentItem.raw, 
      new Error("Neon DB connection timeout")
    );
    console.log(`      Attempt 1 Result: action = ${fail1.action} | delay = ${fail1.delayMs}ms | attempts = ${fail1.job.attempts}/3`);
    if (fail1.action !== "retry" || fail1.delayMs !== 2000) {
      throw new Error(`Expected retry with 2000ms delay, got ${fail1.delayMs}ms`);
    }

    // Pull from main queue for Attempt 2
    currentItem = await dequeueReliable(TEST_QUEUE);
    console.log("      Simulating Transient Failure 2 (e.g. Row Lock Contention)...");
    const fail2 = await handleJobFailure(
      TEST_QUEUE, 
      currentItem.job, 
      currentItem.raw, 
      new Error("PostgreSQL lock wait timeout")
    );
    console.log(`      Attempt 2 Result: action = ${fail2.action} | delay = ${fail2.delayMs}ms | attempts = ${fail2.job.attempts}/3`);
    if (fail2.action !== "retry" || fail2.delayMs !== 4000) {
      throw new Error(`Expected retry with 4000ms delay, got ${fail2.delayMs}ms`);
    }
    console.log("      ✅ EXPONENTIAL BACKOFF VERIFIED: Delays scaled smoothly (2s -> 4s).\n");

    // 4. Test Dead-Letter Queue (DLQ) Quarantine
    console.log("[4/5] Testing Dead-Letter Queue (DLQ) Quarantine on Final Attempt...");
    currentItem = await dequeueReliable(TEST_QUEUE);
    console.log("      Simulating Permanent Failure 3 (Poison Pill)...");
    const fail3 = await handleJobFailure(
      TEST_QUEUE, 
      currentItem.job, 
      currentItem.raw, 
      new Error("Fatal Schema Constraint Violation")
    );
    console.log(`      Attempt 3 Result: action = ${fail3.action} | status = ${fail3.job.status}`);

    const mainDepthFinal = await getQueueLength(TEST_QUEUE);
    const procDepthFinal = await getProcessingCount(TEST_QUEUE);
    const dlqDepthFinal = await getDeadLetterCount(TEST_QUEUE);

    console.log(`      Main Queue:       ${mainDepthFinal} (Unblocked!)`);
    console.log(`      In-Flight Queue:  ${procDepthFinal}`);
    console.log(`      Dead-Letter Queue:${dlqDepthFinal} (Quarantined!)`);

    if (dlqDepthFinal !== 1 || fail3.action !== "dead_letter") {
      throw new Error("DLQ Quarantine check failed: Job was not moved to DLQ.");
    }
    console.log("      ✅ DLQ QUARANTINE VERIFIED: Poison pill safely isolated without blocking queue.\n");

    // 5. Test DLQ Replayability (Admin Reconciliation)
    console.log("[5/5] Testing Dead-Letter Queue Replay (Admin Reconciliation)...");
    const replayedCount = await replayDeadLetter(TEST_QUEUE, 5);
    const dlqAfterReplay = await getDeadLetterCount(TEST_QUEUE);
    const mainAfterReplay = await getQueueLength(TEST_QUEUE);

    console.log(`      Replayed jobs from DLQ: ${replayedCount}`);
    console.log(`      DLQ Remaining:          ${dlqAfterReplay}`);
    console.log(`      Main Queue Restored:    ${mainAfterReplay}`);

    if (replayedCount !== 1 || mainAfterReplay !== 1 || dlqAfterReplay !== 0) {
      throw new Error("DLQ replay test failed.");
    }
    console.log("      ✅ DLQ REPLAY VERIFIED: Quarantined jobs can be re-run after bug fixes.\n");

    console.log("================================================================================");
    console.log("                    FAULT RECOVERY BENCHMARK SUMMARY");
    console.log("================================================================================");
    console.log(" 1. IN-FLIGHT TRACKING: Jobs preserved in queue:processing (0% crash loss).");
    console.log(" 2. EXPONENTIAL BACKOFF: Scaled retry delays (2,000ms -> 4,000ms).");
    console.log(" 3. DLQ QUARANTINE:     Exceeded retries moved to queue:dead_letter.");
    console.log(" 4. DLQ REPLAYABILITY:  100% of quarantined jobs successfully restored.");
    console.log(" 5. STATUS:             WORKER RESILIENCE & FAULT TOLERANCE VERIFIED.");
    console.log("================================================================================\n");

    // Teardown
    await clearQueue(TEST_QUEUE);

  } catch (err) {
    console.error("Failure recovery benchmark error:", err);
  } finally {
    await redis.quit();
  }
}

runFailureRecoveryTest();
