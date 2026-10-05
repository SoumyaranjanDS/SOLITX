# Day 16: Distributed Rate Limiting & The Cache Lifecycle

## Goal
Implement a Distributed Rate Limiter to fix the vulnerability exposed in Day 11, and visualize the entire caching architecture.

## The Action
We installed the `rate-limit-redis` package and connected it to our Upstash Redis instance. We swapped the underlying storage of our Express Rate Limiter from isolated Node.js RAM to shared Redis RAM.

### Why this matters
In Day 11, an attacker sent 150 requests (bypassing our 50-request limit) because we had 3 Node servers behind a Load Balancer that weren't communicating.
Now, when a request hits *any* of the 3 Node servers, the server immediately queries Redis to check the IP's global request count. 
Because Redis acts as a centralized brain, the state is perfectly shared across the entire fleet of servers. The attacker is blocked at exactly 50 requests.

## The Data Layer Architecture
We have successfully established the three pillars of our backend:
1. **PostgreSQL (Source of Truth):** Hard drive-backed, relational structure, B-Tree Indexes, Connection Pooled. Handles all complex logic and ensures data is never lost.
2. **Upstash Redis (The Accelerator & Shield):** RAM-backed, O(1) hashing, volatile. Protects the DB from Repeated Reads and protects the API from DDoS attacks.
3. **Node.js (The Orchestrator):** Validates tokens, handles caching logic (Cache-Aside, Invalidation, Stampede protection), and routes data to the client.

## Next Steps
The core system design and architecture of the backend is essentially complete. We can now safely pivot to building the UI frontend of SOLITX!
