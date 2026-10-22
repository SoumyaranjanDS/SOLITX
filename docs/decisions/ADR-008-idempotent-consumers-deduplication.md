# ADR-008: Idempotent Consumers and Two-Tier Duplicate Elimination

## Status
Accepted

## Context
In Day 27, we solved message loss by establishing **At-Least-Once Delivery** using reliable queue transfers (`RPOPLPUSH`), exponential backoff retries, and dead-letter quarantine (ADR-007). 

However, in distributed systems, guaranteeing *at-least-once* delivery mathematically introduces the risk of duplicate message processing:
1. **Network Partition / Worker Crash Before ACK:** A worker successfully writes a notification to PostgreSQL, but its connection drops or the process crashes before executing `ackJob()`. The pending job watchdog or retry scheduler redelivers the payload.
2. **Producer Retries:** Upstream HTTP clients or message producers may re-dispatch an event if the initial network roundtrip experiences a socket timeout.
3. **Consumer Rebalancing / Concurrency Races:** Multiple background workers running concurrently may ingest duplicate payloads dispatched in rapid bursts.

Without an idempotent consumer, duplicate deliveries cause phantom notifications, duplicate emails, and inflated counters.

## Decision
We implement a **Two-Tier Idempotency & Deduplication Engine** across our asynchronous processing pipeline:

### 1. Deterministic Idempotency Keys
- Every background job payload contains a mandatory, deterministic `idempotency_key`.
- Key format: `notif:{type}:{sourceId}:{recipientId}` (e.g., `notif:post_mention:101:42`).
- Any duplicate dispatch for the exact same business event produces an identical key.

### 2. Tier 1: Fast In-Memory Intercept (Redis `SETNX`)
- Before touching PostgreSQL, the worker queries Redis using atomic `SETNX`:
  ```javascript
  await redis.set(`idempotency:${key}`, "1", "EX", 86400, "NX");
  ```
- If the key already exists (`result === null`), the worker flags the message as a duplicate, executes `ackJob()`, and terminates the handler in $< 1\text{ ms}$.
- **Benefit:** 99.9% of transient duplicate deliveries are rejected in RAM, saving Neon PostgreSQL connection slots, disk I/O, and CPU locks.

### 3. Tier 2: ACID Relational Safety Net (PostgreSQL Unique Index)
- In the relational database, table `notifications` maintains a strict unique constraint:
  ```sql
  CREATE UNIQUE INDEX idx_notifications_idempotency_key ON notifications(idempotency_key);
  ```
- All writes execute with conflict suppression:
  ```sql
  INSERT INTO notifications (user_id, type, message, idempotency_key)
  VALUES ($1, $2, $3, $4)
  ON CONFLICT (idempotency_key) DO NOTHING;
  ```
- If a race condition bypasses Redis (e.g., cache eviction or concurrent execution across distributed nodes), the PostgreSQL unique constraint prevents duplicate rows with zero exception overhead.

### 4. Safe Error Recovery
- If a job fails during processing (e.g., database connection reset), the worker calls `releaseIdempotency(key)`, removing the Redis reservation so subsequent retry attempts can succeed.

## Consequences & Trade-offs
- **Positive:**
  - **Effective Exactly-Once Semantics:** System behavior is indistinguishable from exactly-once processing despite at-least-once network transport.
  - **Zero Database Load for Redundant Retries:** Fast RAM filtering eliminates redundant queries on PostgreSQL.
  - **Resilience to Transient Errors:** Safe release hooks ensure genuine failures are retried without being blocked by premature locks.
- **Negative:**
  - **Storage Overhead:** Requires maintaining Redis keys (24-hour TTL) and PostgreSQL B-Tree index storage.
  - **Deterministic Key Requirement:** All upstream event producers must compute consistent idempotency keys rather than relying on randomized UUIDs.
