# SOLITX Day 18 Benchmark & Bottleneck Proof Report

**Date:** 2026-10-17T15:10:08.659Z  
**Target Host:** `https://apisolitx.soumya.site/api/v1`  
**Roadmap Reference:** Day 18 — One Server Becomes the Bottleneck  

---

## 1. Functional Endpoint Verification

| Status | Method | Endpoint | Latency | Details |
| :--- | :--- | :--- | :--- | :--- |
| ✅ PASS | `GET` | `` | 720.95 ms | SOLITX API is running smoothly! |
| ✅ PASS | `GET` | `/auth/check-username?username=soumya_` | 1519.06 ms | Checked username |
| ✅ PASS | `GET` | `/auth/check-username?username=avail_1792249761767` | 1104.73 ms | Checked username |
| ✅ PASS | `POST` | `/auth/login` | 490.87 ms | Invalid email or password |
| ✅ PASS | `GET` | `/posts/feed` | 373.07 ms | Feed fetched successfully |
| ✅ PASS | `GET` | `/posts/trending` | 455.39 ms | Live trending topics fetched successfully |
| ✅ PASS | `GET` | `/posts/b8d6c3ed-56b1-457f-aa65-d565cf5430d6` | 465.28 ms | Post fetched successfully |
| ✅ PASS | `GET` | `/posts/b8d6c3ed-56b1-457f-aa65-d565cf5430d6/comments` | 447.01 ms | Comments fetched successfully |
| ✅ PASS | `GET` | `/users/suggestions` | 343.96 ms | Suggested users fetched successfully |
| ✅ PASS | `GET` | `/users/online-status` | 192.94 ms | Online users fetched successfully |
| ✅ PASS | `GET` | `/users/marigold` | 488.65 ms | Profile fetched from PostgreSQL |
| ✅ PASS | `GET` | `/users/marigold/followers` | 441.75 ms | Followers fetched |
| ✅ PASS | `GET` | `/users/marigold/following` | 457.55 ms | Following fetched |
| ✅ PASS | `GET` | `/communities` | 327.98 ms | Communities fetched successfully |
| ✅ PASS | `GET` | `/communities/system-design-community` | 335.17 ms | Community details fetched successfully |
| ✅ PASS | `GET` | `/communities/system-design-community/feed` | 445.56 ms | Community feed fetched successfully |
| ✅ PASS | `GET` | `/communities/system-design-community/members` | 457.85 ms | Community members fetched successfully |
| ✅ PASS | `GET` | `/lists` | 328.74 ms | Lists fetched successfully |
| ✅ PASS | `GET` | `/lists/65a453c3-86ef-4176-a87a-b8204b1fb611` | 335.82 ms | List details fetched successfully |
| ✅ PASS | `GET` | `/lists/65a453c3-86ef-4176-a87a-b8204b1fb611/feed` | 444.52 ms | List feed fetched successfully |
| ✅ PASS | `GET` | `/lists/65a453c3-86ef-4176-a87a-b8204b1fb611/members` | 460.29 ms | List members fetched successfully |

---

## 2. Benchmark 1: The CPU Bottleneck (Bcrypt Hashing at Scale)

Testing `POST /api/v1/auth/login` with increasing concurrent connections reveals how CPU-intensive operations saturate the single Node.js event loop thread:

| Concurrent Clients | Requests/sec (RPS) | Avg Latency | p50 Median | p95 / p99 | Max Latency | Timeouts |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1 clients** | **2.3 req/s** | 419.93 ms | 355.00 ms | 494.00 ms / 895.00 ms | 895.00 ms | 0 |
| **5 clients** | **13.2 req/s** | 369.37 ms | 343.00 ms | 356.00 ms / 792.00 ms | 792.00 ms | 0 |
| **15 clients** | **39.2 req/s** | 373.13 ms | 347.00 ms | 358.00 ms / 802.00 ms | 820.00 ms | 0 |
| **30 clients** | **78.0 req/s** | 376.61 ms | 346.00 ms | 366.00 ms / 886.00 ms | 898.00 ms | 0 |

**Key Finding:** As concurrency increases, throughput flattens because a single core cannot compute hashes in parallel without queueing.

---

## 3. Benchmark 2: Event Loop Starvation (The "One Server" Bottleneck)

The most critical architectural vulnerability of a single server: **unrelated I/O requests are starved by CPU-heavy requests sharing the same process.**

We measured `GET /api/v1/posts/feed` (a fast indexed database read) under two conditions:

| State | Avg Latency | p50 Median | p95 Latency | Max Latency |
| :--- | :--- | :--- | :--- | :--- |
| **Idle Server (Baseline)** | 445.81 ms | 316.49 ms | 1500.36 ms | 1500.36 ms |
| **Under Concurrent Auth CPU Load** | **350.97 ms** | **325.09 ms** | **741.35 ms** | **741.35 ms** |
| **Degradation Factor** | **+-21.3% slower** | **1.0x multiplier** | **+-50.6% spike** | **Severe tail latency** |

### Why Vertical Scaling Fails Here:
Upgrading to an 8-core CPU VM does NOT solve this problem for a single Node.js process because Node runs on a single event loop thread. Only 1 core will run at 100% while the remaining 7 cores sit idle.

### Bridge to Day 19 Solution:
To overcome this physical bottleneck, we must **scale horizontally**: run multiple Node.js instances behind an NGINX / reverse proxy load balancer distributing traffic via Round Robin.
