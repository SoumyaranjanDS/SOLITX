# ADR-007: Background Worker Fault Tolerance, Exponential Backoff, and Dead-Letter Queues

## Status
Accepted

## Context
Following the deployment of our asynchronous Redis job queue in Day 25 and notification integration in Day 26, the system introduced new failure modes:
1. If a worker process was killed mid-job, the message was permanently lost because `BRPOP` deleted it immediately.
2. If Neon PostgreSQL suffered a momentary row lock timeout, the job failed with no retry mechanism.
3. Malformed "poison-pill" payloads could crash workers or jam the queue indefinitely.

## Decision
We implement a three-tiered fault tolerance policy for all background queue consumers:

### 1. In-Flight Protection via Atomic RPOPLPUSH
- Workers never dequeue destructively.
- Using `dequeueReliable()`, the job is atomically shifted from `queue:<name>` into `queue:<name>:processing`.
- The job remains tracked in `processing` until the worker calls `ackJob()`.

### 2. Exponential Backoff Retries
- Transient errors (network timeouts, deadlocks) increment `job.attempts`.
- If `job.attempts < 3`, the worker reschedules the job with exponential delay:
  $$\text{Delay} = 2^{\text{attempts}} \times 1,000\text{ ms}$$
  (Attempt 1: 2,000ms delay; Attempt 2: 4,000ms delay).

### 3. Dead-Letter Queue (DLQ) Quarantine & Replay
- When `job.attempts >= 3`, the job is declared unrecoverable.
- The worker moves it to `queue:<name>:dead_letter` alongside failure timestamps and stack traces.
- The main queue continues processing healthy traffic without stalling.
- `replayDeadLetter(queueName, count)` provides administrative tooling to re-enqueue fixed jobs.

## Consequences & Trade-offs
- **Positive:**
  - Guarantees **At-Least-Once Delivery**: Zero message loss during worker crashes or database lockups.
  - Prevents queue head-of-line blocking from malformed messages.
  - Gives databases time to recover from connection pressure via backoff delays.
- **Negative:**
  - **Risk of Duplicate Executions:** Retrying a partially-executed job can result in duplicate database records.
  - Mandates **Idempotent Consumers** (the explicit focus of Day 28).
