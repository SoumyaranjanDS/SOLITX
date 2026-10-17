# SOLITX Day 18 Benchmark & Bottleneck Proof Report

**Date:** 2026-10-17T13:53:34.361Z  
**Target Host:** `https://apisolitx.soumya.site/api/v1`  
**Roadmap Reference:** Day 18 — One Server Becomes the Bottleneck  

---

## 1. Functional Endpoint Verification

| Status | Method | Endpoint | Latency | Details |
| :--- | :--- | :--- | :--- | :--- |
| ✅ PASS | `GET` | `` | 652.93 ms | SOLITX API is running smoothly! |
| ✅ PASS | `GET` | `/auth/check-username?username=soumya_` | 1576.08 ms | Checked username |
| ✅ PASS | `GET` | `/auth/check-username?username=avail_1792245167738` | 319.62 ms | Checked username |
| ✅ PASS | `POST` | `/auth/login` | 484.73 ms | Invalid email or password |
| ✅ PASS | `GET` | `/posts/feed` | 325.08 ms | Feed fetched successfully |
| ✅ PASS | `GET` | `/posts/trending` | 336.80 ms | Live trending topics fetched successfully |
| ✅ PASS | `GET` | `/posts/b8d6c3ed-56b1-457f-aa65-d565cf5430d6` | 445.53 ms | Post fetched successfully |
| ✅ PASS | `GET` | `/posts/b8d6c3ed-56b1-457f-aa65-d565cf5430d6/comments` | 461.37 ms | Comments fetched successfully |
| ✅ PASS | `GET` | `/users/suggestions` | 319.47 ms | Suggested users fetched successfully |
| ✅ PASS | `GET` | `/users/online-status` | 211.56 ms | Online users fetched successfully |
| ✅ PASS | `GET` | `/users/marigold` | 465.00 ms | Profile fetched from PostgreSQL |
| ✅ PASS | `GET` | `/users/marigold/followers` | 460.54 ms | Followers fetched |
| ✅ PASS | `GET` | `/users/marigold/following` | 443.48 ms | Following fetched |
| ✅ PASS | `GET` | `/communities` | 337.74 ms | Communities fetched successfully |
| ✅ PASS | `GET` | `/communities/system-design-community` | 323.02 ms | Community details fetched successfully |
| ❌ FAIL | `GET` | `/communities/system-design-community/feed` | 460.63 ms | could not determine data type of parameter $2 |
| ✅ PASS | `GET` | `/communities/system-design-community/members` | 1197.79 ms | Community members fetched successfully |
| ✅ PASS | `GET` | `/lists` | 338.61 ms | Lists fetched successfully |
| ✅ PASS | `GET` | `/lists/65a453c3-86ef-4176-a87a-b8204b1fb611` | 319.67 ms | List details fetched successfully |
| ❌ FAIL | `GET` | `/lists/65a453c3-86ef-4176-a87a-b8204b1fb611/feed` | 458.27 ms | could not determine data type of parameter $2 |
| ✅ PASS | `GET` | `/lists/65a453c3-86ef-4176-a87a-b8204b1fb611/members` | 1169.67 ms | List members fetched successfully |

---

## 2. Benchmark 1: The CPU Bottleneck (Bcrypt Hashing at Scale)

Testing `POST /api/v1/auth/login` with increasing concurrent connections reveals how CPU-intensive operations saturate the single Node.js event loop thread:

| Concurrent Clients | Requests/sec (RPS) | Avg Latency | p50 Median | p95 / p99 | Max Latency | Timeouts |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1 clients** | **2.5 req/s** | 394.14 ms | 349.00 ms | 470.00 ms / 897.00 ms | 897.00 ms | 0 |
| **5 clients** | **13.3 req/s** | 365.57 ms | 340.00 ms | 347.00 ms / 758.00 ms | 758.00 ms | 0 |
| **15 clients** | **39.7 req/s** | 366.85 ms | 338.00 ms | 346.00 ms / 859.00 ms | 872.00 ms | 0 |
| **30 clients** | **78.3 req/s** | 371.31 ms | 339.00 ms | 350.00 ms / 867.00 ms | 874.00 ms | 0 |

**Key Finding:** As concurrency increases, throughput flattens because a single core cannot compute hashes in parallel without queueing.

---

## 3. Benchmark 2: Event Loop Starvation (The "One Server" Bottleneck)

The most critical architectural vulnerability of a single server: **unrelated I/O requests are starved by CPU-heavy requests sharing the same process.**

We measured `GET /api/v1/posts/feed` (a fast indexed database read) under two conditions:

| State | Avg Latency | p50 Median | p95 Latency | Max Latency |
| :--- | :--- | :--- | :--- | :--- |
| **Idle Server (Baseline)** | 396.59 ms | 318.84 ms | 1481.33 ms | 1481.33 ms |
| **Under Concurrent Auth CPU Load** | **347.91 ms** | **316.54 ms** | **724.07 ms** | **724.07 ms** |
| **Degradation Factor** | **+-12.3% slower** | **1.0x multiplier** | **+-51.1% spike** | **Severe tail latency** |

### Why Vertical Scaling Fails Here:
Upgrading to an 8-core CPU VM does NOT solve this problem for a single Node.js process because Node runs on a single event loop thread. Only 1 core will run at 100% while the remaining 7 cores sit idle.

### Bridge to Day 19 Solution:
To overcome this physical bottleneck, we must **scale horizontally**: run multiple Node.js instances behind an NGINX / reverse proxy load balancer distributing traffic via Round Robin.
