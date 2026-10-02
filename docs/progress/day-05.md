# Day 05: Authentication Meets Scale (Rate Limiting)
**Status**: Completed

Built:
- Implemented `express-rate-limit` for Node.js API.
- Created `authLimiter`: Strict Fixed Window (5 requests per 15 minutes) for `/login` and `/register`.
- Created `apiLimiter`: General Fixed Window (100 requests per 15 minutes) for standard routes.

Learned:
- The distinction between Rate Limiter Storage (In-Memory vs Distributed) and Algorithms (Fixed Window, Sliding Window, Token Bucket).
- Why `express-rate-limit` is an algorithm (Fixed Window), not just magic.
- Why building custom Token Bucket algorithms in Node.js RAM is reinventing the wheel, but building them in Redis later using Lua scripts and `ZSET` is the correct architectural choice for distributed systems.
- Why `bcrypt` is a massive vulnerability without rate limiting due to Node.js's single-threaded event loop.

Tested:
- Brute force attempts on `/api/v1/auth/login` successfully throw `429 Too Many Requests`.

Next problem:
In-memory rate limiting works perfectly for our current Monolith. But, what happens when we eventually scale horizontally and have *two* Node.js servers behind a Load Balancer? Server A won't know about Server B's memory. This will eventually require a centralized memory store (Redis). But for now, we need to design the core Database schema.
