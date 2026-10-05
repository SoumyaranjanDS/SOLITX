# Day 14: Cache Invalidation

## Goal
Solve the problem of "Stale Data" that occurs when the Database is updated but Redis still holds an old, cached copy.

## The Problem
In Day 13, we cached user profiles in Redis with a TTL of 5 minutes (`EX 300`). 
If a user updates their bio 1 minute after it was cached, the backend successfully runs `UPDATE users SET bio = $1`. The PostgreSQL database is now up to date.
However, if a client requests that user's profile, the backend will check Redis first. Redis still has the *old* profile data and won't expire for another 4 minutes. Millions of users will be served the outdated bio. This is called **Stale Data**.

## The Solution: Active Cache Invalidation
We must ensure that whenever the "Source of Truth" (PostgreSQL) is mutated, the cache is immediately cleared.

**Implementation:**
We added a `PUT /api/v1/test/user/:username` endpoint.
When it receives an update:
1. It updates PostgreSQL.
2. If successful, it immediately runs `redis.del('user:username')`.

Because the cache key is deleted, the *very next* `GET` request will result in a **Cache Miss**, forcing the backend to fetch the fresh data from PostgreSQL and re-save it to Redis. Consistency is maintained.

## Key Takeaway
"There are only two hard things in Computer Science: cache invalidation and naming things." - Phil Karlton.
We chose a **Write-Around + Explicit Invalidation** strategy, which perfectly balances read performance with strong consistency on writes.
