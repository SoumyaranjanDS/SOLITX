# Day 8: Measure Before Scaling (Load Testing)

## Goal
Establish a mathematical baseline of our monolith's performance to identify the true bottlenecks before blindly scaling. 

## Action Taken
1. Injected a temporary database read endpoint (`GET /api/v1/test/feed/:user_id`) directly into `server.js` that bypasses rate limiting.
2. Ran a load test using `autocannon` to simulate 500 concurrent connections hitting the server for 10 seconds.

## Results
- **Avg Req/Sec**: ~26.5
- **Avg Latency**: 6,296 ms (6.2 seconds)
- **Max Latency**: 10,013 ms
- **Timeouts**: 235 crashed requests

## Conclusion: The Connection Bottleneck
Even though our Day 7 Database Index completes the query in 0.086 ms, the Node.js `pg.Pool` defaults to a `max` connection limit of 10.
When 500 requests hit Express, 10 are sent to the database, and 490 wait in memory. 
This internal queueing caused massive latency spikes and eventual Timeout crashes.

## Next Steps
We must implement a proper Database Connection Pool and possibly a Database Proxy (like PgBouncer) in Day 9 to massively increase concurrency throughput.
