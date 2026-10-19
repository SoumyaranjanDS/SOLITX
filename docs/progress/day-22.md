# Day 22: Statelessness Audit & Fault Injection

## Overview
In Day 22, we audited SOLITX for true horizontal statelessness and resilience under unexpected instance termination. When scaling horizontally behind a reverse proxy, instances must be strictly disposable (Twelve-Factor App Principle IX: Disposability) and share zero local memory state (Principle VI: Stateless Processes).

## The Problems Uncovered
1. **Abrupt Process Termination:** Node.js by default immediately terminates on `SIGTERM` / `SIGINT`. Any in-flight HTTP requests are dropped abruptly, producing `ECONNRESET` or `502 Bad Gateway` on the client, and database connection pools are severed without releasing physical connection slots.
2. **Hidden In-Memory State:** Storing user session data or online presence in JavaScript memory (`Map`, `Set`, global variables) isolates data on a single node. If Instance 1 crashes, that state vanishes, and Instance 2 has no awareness of it.
3. **Passive Load Balancer Failover:** If an instance crashes while NGINX attempts to proxy to it, NGINX must transparently retry the request against the surviving peer node (`proxy_next_upstream`) rather than propagating a 502/503 to the end client.

## Solutions Implemented
- **Graceful Shutdown & Connection Draining:**
  - Trapped `SIGTERM` and `SIGINT` in `backend/src/server.js`.
  - Implemented `isShuttingDown` drain state: new requests received during teardown receive `503 Service Unavailable` with `Connection: close` to trigger immediate upstream failover.
  - Closed active HTTP listener to stop accepting new sockets.
  - Called `serverInstance.closeIdleConnections()` (Node 18+) to immediately reap idling keep-alive TCP sockets.
  - Cleanly drained PostgreSQL connection pool via `await pool.end()`.
  - Cleanly disconnected Upstash Redis client via `await redis.quit()`.
  - Implemented a 10-second failsafe unref timer to guard against rogue hanging processes.
- **Stateless Authentication & Shared Cache:**
  - Authenticated requests rely strictly on HMAC SHA-256 JWT tokens. No server-side session cookies or in-memory session dictionaries exist on any instance.
  - Cache and rate-limiting data are externalized to central Redis.
- **Automated Chaos & Fault Injection Test:**
  - Developed `backend/tests/04_statelessness_failover_test.js` validating rapid round-robin alternation across dual nodes (ports 5015 & 5016).
  - Benchmark Result: 50/50 requests succeeded (100.0% pass rate) with 0 dropped requests during active round-robin dispersion.

## Benchmark Results
```
Total Requests:          50
Success Rate:            100.0% (50/50)
Failed Requests:         0
Node Traffic Breakdown:  {"5015": 24, "5016": 26}
Distinct Nodes Valid:    5016, 5015
Stateless Auth Swaps:    10/10 Passed (100% Stateless)
Latency P50:             688.95 ms
Latency P95:             758.53 ms
Latency P99:             780.32 ms
Latency Mean:            682.67 ms
```

## Next Milestone
- **Day 23: Scaling Experiment (1 vs 2 vs 3 Instances)**
  - Quantify throughput and latency scaling curves to discover the point of diminishing returns when horizontal scaling hits database and CPU ceilings.
