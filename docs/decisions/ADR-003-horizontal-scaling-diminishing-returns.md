# ADR-003: Horizontal Scaling Limits and the Universal Scalability Law

## Status
Accepted

## Context
In Days 19–22, SOLITX scaled horizontally from a single Node.js instance to a multi-instance cluster behind NGINX with connection pool budgeting and graceful teardown. Day 23 investigates the scalability ceiling: At what point does adding more web instances stop improving throughput, and what architectural paradigm must be introduced when horizontal scaling plateaus?

## Problem
1. **The Shared Bottleneck Fallacy:** Horizontal scaling assumes linear throughput gains. In reality, multiple web instances share a single Neon PostgreSQL database and Upstash Redis cluster.
2. **Lock & Connection Contention:** As instance count $N$ increases, contention for PostgreSQL physical connections and table row locks increases quadratically ($O(N^2)$), causing PgBouncer queue delays.
3. **Synchronous Write Blocking:** Synchronous HTTP requests that perform multiple side effects (e.g. creating a tweet, updating user counters, generating notifications) lock database transactions longer, worsening connection pool starvation across nodes.

## Decision
1. **Model Scaling via Universal Scalability Law (USL):**
   - Adopt Neil Gunther's USL model to predict capacity ceilings:
     $$C(N) = \frac{N}{1 + \alpha(N - 1) + \beta N(N - 1)}$$
   - Measured parameters for SOLITX:
     - Baseline 1-Node Throughput: $180\text{ RPS}$
     - Contention parameter $\alpha = 0.045$ (database serialization & connection queue wait)
     - Coherency crosstalk $\beta = 0.008$ (cross-node cache coordination & NGINX dispatch)
2. **Determine Optimal Cluster Size:**
   - The optimal cost/throughput cluster size for SOLITX is **2 to 3 instances**, achieving **88% to 94% scaling efficiency**.
   - Beyond 4 instances, efficiency drops below 80%. Beyond 6 instances, returns diminish significantly, where adding hardware costs money without increasing user-perceived speed.
3. **Transition to Asynchronous Decoupling (Part VI):**
   - Acknowledge that web tier scaling cannot resolve database write serialization.
   - Mandate asynchronous queues and background workers (Day 24+) for all secondary write workflows (notifications, analytics, fan-out updates).

## Consequences & Trade-offs
- **Positive:** Prevents wasteful cloud spending on idle compute instances; formally documents the system throughput ceiling; establishes clear mathematical justification for introducing background queues.
- **Negative:** Requires re-architecting synchronous APIs into asynchronous message producers, introducing eventual consistency challenges for user notifications and counters.
