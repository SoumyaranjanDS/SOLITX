# ADR-004: Defining Synchronous vs. Asynchronous Execution Boundaries

## Status
Accepted

## Context
During Days 18–23, SOLITX scaled horizontally from a single Node.js instance to a multi-instance cluster behind NGINX. While horizontal scaling multiplied compute capacity for read traffic, write latency remained bound by database connection contention and sequential query execution.

Profiling the write lifecycle in Day 24 (`POST /posts`, `POST /posts/:id/like`, `POST /posts/:id/comments`) revealed that **75.8% to 88.1% of request blocking time is spent executing non-critical side effects** (in-app notifications, follower fanouts, aggregate counter queries, and cache invalidation).

## Problem
1. **High Perceived Latency:** Clients wait between 1,000ms and 2,200ms for write operations to resolve sequentially in the HTTP loop.
2. **Cascading Failure Risk:** A transient slowdown or database lock on the `notifications` table causes the primary `INSERT INTO posts` transaction to fail or timeout, degrading core system availability.
3. **Database Connection Pool Depletion:** Holding database pool connections open while executing secondary work reduces overall API cluster concurrency by up to 5x.

## Decision
We establish a strict **Synchronous vs. Asynchronous Boundary Policy** for all SOLITX APIs:

### 1. Synchronous Work (Critical Path Only)
An operation is permitted to execute synchronously inside the HTTP request loop **if and only if**:
- It validates incoming request schema, payload limits, and authentication/authorization permissions.
- It writes the immutable core entity (`posts`, `comments`, `follows`, `likes`) to PostgreSQL with immediate ACID durability guarantees.
- Returning `201 Created` or `200 OK` is impossible without confirming this write succeeded.

### 2. Asynchronous Work (Secondary Side-Effects)
All auxiliary operations are categorized as secondary and **must be offloaded to an asynchronous background worker pool**:
- **Notifications:** In-app notification creation, mention parsing (`@username`), and push alerts.
- **Counter Aggregations:** Recalculating like counts, reply counts, or follower counts.
- **Fanout & Cache Updates:** Pushing post IDs into follower home timeline Redis lists (`LPUSH timeline:<follower_id>`).
- **Analytics & Search:** Indexing content for trending hashtag algorithms and search filters.

### 3. Queue Contract
- The API instance acts strictly as a **Job Producer**, publishing a lightweight JSON payload to Redis (`RPUSH` / BullMQ) in **< 5 ms**.
- The API immediately returns HTTP `201 Created` with the newly created post object.
- A decoupled **Job Consumer** worker process dequeues the job and executes the secondary database writes and Redis updates with built-in retry and backoff semantics.

## Consequences & Trade-offs
- **Positive:**
  - Client write latency drops from ~1,080–2,200ms to **~265ms** (an **8.3x speedup** / 88% latency reduction).
  - Database pool connections are released back to the pool 4x faster.
  - Failures in notification delivery no longer break post or comment creation.
- **Negative:**
  - Introduces **Eventual Consistency**: A user's notification or timeline feed may reflect changes with a 100–500ms delay.
  - Increases architectural complexity by requiring a dedicated worker process, job queue monitoring, and error retry handlers (to be addressed in Days 25–28).
