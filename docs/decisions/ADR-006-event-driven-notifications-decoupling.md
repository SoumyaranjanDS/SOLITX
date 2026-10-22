# ADR-006: Event-Driven Notifications Decoupling via Redis Queue

## Status
Accepted

## Context
In Days 24 and 25, we profiled write latency and built a Redis-backed Producer-Consumer queue. Prior to Day 26, whenever a user liked a tweet, replied to a comment, or followed someone, the HTTP request loop directly executed an `INSERT INTO notifications` query on Neon PostgreSQL, holding client responses and database connection pool slots for an extra ~260ms to 1,290ms.

## Problem
1. **Unnecessary Client Wait:** Users were forced to wait for notification insertion before receiving confirmation that their like or reply succeeded.
2. **Blast Radius:** If the `notifications` table experienced table locks or row-level contention, primary write operations (e.g. liking a tweet) would fail completely.
3. **Connection Starvation:** Web instances held pool connections open across both primary and auxiliary database writes.

## Decision
1. **Refactor `createNotification()` into a Non-Blocking Producer:**
   - Instead of writing directly to PostgreSQL, `createNotification()` packages an event payload and calls `enqueueJob('notifications', payload)` via Redis `LPUSH`.
   - Dispatch latency drops to **~45ms** (or ~3ms on local network).
2. **Dedicated Background Consumer:**
   - Standalone background workers (`src/worker.js`) listen on `queue:notifications` via `BRPOP` and asynchronously execute the PostgreSQL insert.
3. **Graceful Fallback Mode:**
   - If Redis is unreachable, `notificationService.js` catches the queue failure and falls back to a direct PostgreSQL insert, guaranteeing zero notification drop even under queue infrastructure outages.

## Consequences & Trade-offs
- **Positive:**
  - Client response times for likes, replies, and follows drop significantly (~60% latency reduction).
  - Isolates notification database failures from user interaction requests.
  - Shields the primary PostgreSQL database connection pool.
- **Negative:**
  - Introduces **eventual consistency**: A recipient's notification badge may appear ~100–350ms after the like occurred.
  - Requires handling worker crash recovery and retries (Day 27).
