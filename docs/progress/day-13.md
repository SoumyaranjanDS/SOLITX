# Day 13: Introducing Redis (Cache-Aside Pattern)

## Goal
Solve the Database Repeated Reads problem by implementing a blazing-fast caching layer.

## Action Taken
1. Created an Upstash Serverless Redis database and added the `REDIS_URL` to our environment variables.
2. Installed the `ioredis` Node.js client.
3. Created a new API route `GET /api/v1/test/user/:username` to implement the Cache-Aside architecture.

## The Cache-Aside Flow
When a user requests a profile:
1. **Cache Check:** `await redis.get('user:cristiano')`
2. **Cache Hit:** If found, the data is returned instantly to the user without touching PostgreSQL.
3. **Cache Miss:** If not found, the backend queries PostgreSQL.
4. **Cache Populate:** The backend saves the PostgreSQL result to Redis with a TTL of 300 seconds (`EX 300`).

## Results
- **First Request (Miss):** Queries PostgreSQL.
- **Next 5 Minutes (Hits):** 100% of traffic is served directly from Redis RAM. The database load is completely mitigated.
- **TTL Expiration:** After 5 minutes, the cache clears. The next request hits the DB once, refreshing the data with any updates.

## Next Steps
Now that Redis is successfully implemented for data caching, we can reuse it to solve the architectural flaw from Day 11: we must rebuild our Rate Limiter to be distributed, using Redis as the central tracking store.
