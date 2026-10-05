# Day 11: API Protection (The Distributed Flaw)

## Goal
Identify the severe architectural flaw with our Day 5 Rate Limiting implementation when scaling horizontally.

## The Flaw
In Day 5, we used `express-rate-limit` to store request counts in the Node.js RAM.
If we scale to 5 Node.js servers behind a Load Balancer, an attacker can bypass the limit. Because the Load Balancer splits traffic evenly across the 5 servers, and each server only checks its *own* isolated RAM, the attacker can successfully send 5x the allowed requests.

## The Solution Requirements
We need a **Centralized Store** to track rate limits that all servers can check instantly.

- **Why not PostgreSQL?** If 5 servers hit the database on every single incoming API request just to check rate limits, the database connection pool will immediately saturate and the DB will crash.
- **The Answer:** An In-Memory Datastore that operates at microsecond speeds. 

This architectural problem dictates the absolute necessity of **Redis**. In Day 13, we will install Redis to solve this issue (alongside database caching).
