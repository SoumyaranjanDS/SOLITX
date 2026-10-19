# ADR-002: Statelessness Architecture and Graceful Teardown Lifecycle

## Status
Accepted

## Context
SOLITX runs multiple concurrent backend instances behind an NGINX reverse proxy (`5015` and `5016`). When scaling horizontally, server processes must be completely disposable. Any sudden termination (e.g. process restart, deployment, pod eviction, OOM) risks dropping in-flight HTTP transactions with `502 Bad Gateway` and leaving zombie connections open in the PostgreSQL pool.

## Problem
1. **Abrupt Signal Handling:** Default Node.js behavior abruptly kills the event loop on `SIGTERM` / `SIGINT`. Active HTTP requests are aborted mid-flight.
2. **Postgres Connection Leakage:** Dirty socket terminations leave connection slots allocated on the Neon/PgBouncer pool until TCP keepalive timeouts fire minutes later.
3. **Session Affinity Lock-in:** Storing state (session cookies, user caches, online presence) in process memory forces sticky sessions (session affinity), preventing even load distribution and causing user logout if a node crashes.

## Decision
1. **Stateless Share-Nothing Architecture (12-Factor App VI):**
   - Eliminate all local in-memory session stores.
   - Use HMAC SHA-256 JWTs for authentication. Any backend instance can verify any client request without cross-node synchronization.
   - Centralize caching, invalidation tokens, and rate limits in Upstash Redis.
2. **Graceful Draining Teardown (12-Factor App IX):**
   - Intercept `SIGTERM` and `SIGINT` signals in `backend/src/server.js`.
   - Toggle `isShuttingDown = true` to immediately reject new incoming requests with HTTP 503 (`Connection: close`), prompting upstream proxies to immediately failover.
   - Close HTTP listener via `httpServer.close()` and drop idle keep-alive connections via `closeIdleConnections()`.
   - Await `pool.end()` to flush and close PostgreSQL pooled sockets cleanly.
   - Await `redis.quit()` to cleanly release Upstash Redis TCP sockets.
   - Enforce a 10-second unref timeout failsafe to guarantee clean process exit without hanging indefinitely.
3. **Reverse Proxy Retry Fallback:**
   - Configure NGINX `proxy_next_upstream` for `error timeout invalid_header http_502 http_503 http_504` so any transient node shutdown is automatically routed to a live peer without client disruption.

## Consequences & Trade-offs
- **Positive:** Zero dropped in-flight requests during rolling deployments; no database pool exhaustion from severed sockets; true round-robin load distribution.
- **Negative:** Rolling reloads require up to 10 seconds of drain grace time before an old instance fully halts; WebSockets require Redis Pub/Sub adapter to broadcast events across distinct node instances.
