# Day 27: Failure in Background Jobs — Retries, Exponential Backoff & DLQs

## Overview
In Day 27, we solved the critical failure modes of asynchronous processing: **What happens when a background worker crashes halfway through a job, or Neon PostgreSQL throws a temporary lock timeout?**

We upgraded our Redis queue and worker architecture to support **At-Least-Once Delivery**, **Automatic Retries with Exponential Backoff**, and **Dead-Letter Queue (DLQ) Quarantine**, ensuring our asynchronous pipeline is resilient against both transient network glitches and unrecoverable poison-pill messages.

---

## The Three Failure Scenarios & Solutions

| Failure Mode | Root Cause | Without Day 27 | With Day 27 Architecture |
| :--- | :--- | :--- | :--- |
| **1. Worker Crash Mid-Job** | Process SIGKILL, Out of Memory, host reboot | Job is permanently lost (popped from Redis before DB write) | **Reliable RPOPLPUSH:** Job stays preserved in `queue:<name>:processing` until explicit DB ACK. |
| **2. Transient DB Lock** | Row-level write lock, connection pool timeout | Job fails and is discarded, or loops infinitely burning CPU | **Exponential Backoff:** Retried after $2^{\text{attempts}} \times 1,000\text{ms}$ delay (2s $\rightarrow$ 4s $\rightarrow$ 8s). |
| **3. Poison-Pill Payload** | Malformed data, permanent foreign key violation | Crashes worker or jams queue head forever | **Dead-Letter Queue (DLQ):** Quarantined to `queue:<name>:dead_letter` after 3 failed attempts, keeping queue flowing. |

---

## Empirical Benchmark Results (Day 27)
Executed [`backend/tests/09_queue_failure_recovery_test.js`](../../backend/tests/09_queue_failure_recovery_test.js) against live Upstash Redis:

```text
================================================================================
    SOLITX ARCHITECTURE BENCHMARK: DAY 27 — FAILURE RECOVERY & DLQ
================================================================================
[2/5] Testing In-Flight Safety (dequeueReliable via RPOPLPUSH)...
      Queue pending before: 1 | after: 0
      In-Flight processing count: 1 (Preserved in processing set!)
      ✅ AT-LEAST-ONCE DELIVERY SAFETY VERIFIED: Job is preserved during crashes.

[3/5] Testing Exponential Backoff Retry Loop...
      Simulating Transient Failure 1 (Database Deadlock)...
      Attempt 1 Result: action = retry | delay = 2000ms | attempts = 1/3
      Simulating Transient Failure 2 (Row Lock Contention)...
      Attempt 2 Result: action = retry | delay = 4000ms | attempts = 2/3
      ✅ EXPONENTIAL BACKOFF VERIFIED: Delays scaled smoothly (2s -> 4s).

[4/5] Testing Dead-Letter Queue (DLQ) Quarantine on Final Attempt...
      Simulating Permanent Failure 3 (Poison Pill)...
      Attempt 3 Result: action = dead_letter | status = dead_letter
      Main Queue:       0 (Unblocked!)
      In-Flight Queue:  0
      Dead-Letter Queue:1 (Quarantined!)
      ✅ DLQ QUARANTINE VERIFIED: Poison pill safely isolated without blocking queue.

[5/5] Testing Dead-Letter Queue Replay (Admin Reconciliation)...
      Replayed jobs from DLQ: 1
      DLQ Remaining:          0
      Main Queue Restored:    1
      ✅ DLQ REPLAY VERIFIED: Quarantined jobs can be re-run after bug fixes.
================================================================================
```

---

## Key Resilience Primitives Introduced
1. **Explicit Acknowledgment (`ackJob`):** Workers remove jobs from `queue:<name>:processing` only after `pool.query()` succeeds.
2. **Backoff Math ($2^{\text{attempts}} \times 1,000\text{ms}$):** Prevents the "Thundering Herd" problem by giving the database time to recover from locks.
3. **DLQ Replayability (`replayDeadLetter`):** Quarantined jobs are not deleted. When engineers patch the underlying bug, a single command restores failed jobs back to the main queue for automated execution.

---

## Next Milestone: Day 28 — Duplicate Messages & Idempotency
* **Problem:** Because workers retry jobs after crashes, a job might be executed more than once (*At-Least-Once Delivery*).
* **Solution:** Implement **Idempotent Consumers** using unique PostgreSQL indexes and Redis deduplication keys.
