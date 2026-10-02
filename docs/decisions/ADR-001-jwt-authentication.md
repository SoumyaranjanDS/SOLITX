# ADR-001 — Authentication Strategy

## Status
Accepted

## Context
SOLITX requires secure, authenticated API requests to allow users to publish and view dispatches on the editorial network.

## Problem
We need an authentication mechanism that secures routes, protects passwords, and crucially, works seamlessly when we eventually horizontally scale our API instances behind a load balancer.

## Options
1. Server-side session cookies (Stateful)
2. JWT access tokens (Stateless)
3. JWT + Redis centralized sessions (Hybrid)

## Decision
Use short-lived JWT (JSON Web Tokens) access tokens for V1.

## Why
The initial system is a monolith, but our roadmap demands horizontal scaling. By using JWTs, the server does not need to store session state in memory or perform a database lookup to verify a user's identity. It only needs the secret key to cryptographically verify the token. This allows infinite horizontal scaling of the Node.js instances immediately.

## Trade-offs
Advantages:
- Stateless verification (Zero DB lookups for protected routes).
- Extremely easy horizontal scaling.
- Cross-domain compatibility.

Disadvantages:
- Revocation is difficult (cannot easily "kill" a session before it expires).
- Token size is larger than a standard session ID.

## Consequences
Future authentication changes, particularly around forcing a user log-out globally or handling compromised accounts, will require us to implement either a token blocklist (Redis) or refresh-token rotation.
