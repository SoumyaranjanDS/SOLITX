# ADR-005: Redis List-Backed Asynchronous Job Queue

## Status
Accepted

## Context
Following the Day 24 audit, which revealed that 75% to 88% of write latency was wasted on non-critical secondary side-effects (notifications, fanouts, aggregate counter queries), SOLITX required an asynchronous job queue to decouple the API response from background processing.

## Options Considered

1. **Option A: Apache Kafka / RabbitMQ**
   - *Pros:* High streaming throughput, partition ordering, distributed broker clustering.
   - *Cons:* Severe operational complexity (JVM, Zookeeper/KRaft, broker maintenance, high memory footprint), completely disproportionate for our ~20K DAU design target.
2. **Option B: Node.js In-Memory Queue (`EventEmitter` / `setImmediate`)**
   - *Pros:* Zero latency overhead, simple code.
   - *Cons:* Complete data loss on server restarts, deployment rollouts, or unhandled exceptions. Incompatible with multi-instance horizontal scaling.
3. **Option C: Redis-Backed Queue (Selected)**
   - *Pros:* Leverages existing Upstash Redis deployment, persistent in-memory storage, $< 5\text{ms}$ atomic list operations (`LPUSH`, `RPOP`, `BRPOP`), zero new infrastructure cost.
   - *Cons:* Requires custom worker loop or libraries like BullMQ; memory consumption scales with unprocessed queue backlog.

## Decision
We adopt **Option C: Redis-Backed Queue** as the standard asynchronous message broker for SOLITX.

### Architectural Rules:
1. **Producer Contract (`src/queue/jobQueue.js`):**
   - The Express API acts strictly as a Producer.
   - Enqueues jobs using atomic `LPUSH queue:<name> <serialized_job>` in non-blocking fashion.
   - Assigns a unique Job ID (`job_<timestamp>_<random>`) and captures creation timestamp.
2. **Consumer Contract (`src/worker.js`):**
   - Background workers run as decoupled, standalone Node.js processes.
   - Uses `BRPOP` with a 2-second timeout to wait for incoming tasks with zero CPU spin.
   - Traps `SIGTERM` / `SIGINT` to allow active in-flight jobs to complete cleanly before exit.
3. **Queue Naming & Separation:**
   - Dedicated queues per domain: `queue:notifications` for user alerts, `queue:feed_fanout` for follower cache updates.

## Consequences & Trade-offs
- **Positive:**
  - Decouples write response time from downstream side-effects.
  - Zero added hosting cost or infrastructure overhead.
  - Shields PostgreSQL connection pool from traffic burst exhaustion by acting as a queue buffer.
- **Negative:**
  - Introduces eventual consistency for notifications and feed updates.
  - Requires worker crash handling, retries, and dead-letter queue semantics (addressed in Days 27–28).
