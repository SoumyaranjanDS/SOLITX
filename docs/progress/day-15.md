# Day 15: Cache Stampede (Thundering Herd)

## Goal
Identify the final catastrophic failure mode of caching: what happens when a highly popular cache key expires during peak load.

## The Disaster Scenario
We set a TTL of 5 minutes (`EX 300`) on Cristiano Ronaldo's profile.
1. `04:59` - Redis is comfortably serving 10,000 requests per second from RAM.
2. `05:00` - The TTL expires. Redis deletes the key.
3. `05:01` - 10,000 requests arrive in the exact same millisecond. 
4. `05:01` - All 10,000 requests check Redis and get a **Cache Miss**.
5. `05:01` - All 10,000 requests query PostgreSQL at the exact same time.
6. `05:02` - PostgreSQL CPU hits 100%, runs out of connections, and crashes. SOLITX goes offline.

This is known as a **Cache Stampede** or the **Thundering Herd** problem.

## Mitigation Strategies
There are several ways to prevent this in large distributed systems:

1. **Request Coalescing (Distributed Locks)**
When the first cache miss happens, the backend acquires a distributed lock in Redis. The other 9,999 requests are forced to wait. The first request queries the DB, saves the result to Redis, and releases the lock. The 9,999 waiting requests then fetch the newly cached data from Redis.

2. **Jitter**
Instead of setting a TTL to exactly 300 seconds for every object, we add a randomized "jitter" (e.g., `300 + random(0, 60)` seconds). This prevents massive lists of keys from all expiring simultaneously.

3. **Refresh-Ahead / Background Updates**
For extremely hot keys (like Ronaldo's profile), we don't let the cache expire at all. Instead, a background cron job fetches the latest data from the DB and updates Redis every 4 minutes. The users only ever hit the cache, and the DB only ever sees the cron job.

## Conclusion
With Cache-Aside, Invalidation, and Stampede prevention, our API is fully robust. The Database is protected from both Repeated Reads and Thundering Herds. We can now transition focus.
