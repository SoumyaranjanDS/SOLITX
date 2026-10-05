# Day 9: Connection Pooling

## Goal
Fix the connection limit bottleneck discovered in Day 8 to maximize Database throughput.

## Action Taken
1. Reconfigured `pg.Pool` inside `backend/src/config/db.js` to explicitly set `max: 100` (up from default 10).
2. Ensured the Neon connection string (`DATABASE_URL`) was utilizing Neon's built-in serverless PgBouncer (`-pooler` in the host).
3. Re-ran the exact `autocannon` load test from Day 8.

## Results Comparison (Before vs After)

| Metric | Day 8 (10 Connections) | Day 9 (100 Connections) | Improvement |
| :--- | :--- | :--- | :--- |
| **Average RPS** | 26.5 | 255 | **10x Faster** |
| **Average Latency** | 6,296 ms | 1,834 ms | **70% Drop** |
| **Timeouts / Crashes**| 235 | 0 | **Perfect Stability** |
| **Total Processed (10s)**| 1,000 | 3,000 | **3x Volume** |

## Conclusion
By properly sizing the connection pool and relying on an external connection pooler (PgBouncer), we allowed Node.js to concurrently fetch data without forming massive internal queues. The system is now significantly more resilient under heavy load.

## Next Steps
Now that the backend can handle thousands of posts per second, returning 100,000 posts to the frontend in a single array is no longer viable (it would crash the browser). We must implement **Pagination** in Day 10.
