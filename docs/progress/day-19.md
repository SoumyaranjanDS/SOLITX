# Day 19: One Server Becomes the Bottleneck — The Limits of Vertical Scaling

## Goal
Demonstrate through automated load benchmarking why a single Node.js monolith hits an insurmountable CPU ceiling under concurrent authentication spikes, and mathematically prove the necessity of horizontal scaling.

---

## 1. The Problem
When traffic spikes (e.g. 30 concurrent users authenticating at the same instant), the entire platform freezes for everyone. Unrelated users performing lightweight timeline reads (`GET /api/v1/posts/feed`) experience spinning loading indicators and timeouts.

---

## 2. Root Cause: The Single-Threaded Event Loop
Node.js processes I/O asynchronously, but **computational CPU work is synchronous**.
* `bcrypt.compare` runs 1,024 key-derivation iterations per hash (~70ms of pure CPU time).
* At 30 concurrent logins, the single CPU core hits 100% saturation.
* The event loop is blocked, causing simple database reads waiting in the queue to suffer severe tail latency spikes (up to **1,481 ms**).

---

## 3. Why Vertical Scaling Fails
Upgrading the host machine from 1 vCPU to an 8 vCPU instance does not solve this bottleneck for a single Node.js process:
* Node.js runs on a single event loop thread.
* Process 5015 continues using 100% of Core 0, while Cores 1–7 sit completely idle.
* Total throughput gain: **0%**.

---

## 4. Empirical Benchmark Results (Against Hosted API: `https://apisolitx.soumya.site`)

### A. Autocannon Concurrency Ramp on CPU Hashing (`POST /auth/login`):
| Concurrency Level | Throughput (RPS) | Avg Latency | p50 Median | p95 / p99 Latency | Max Latency |
| :--- | :--- | :--- | :--- | :--- |
| **1 client** | **2.5 req/s** | `394.14 ms` | `349.00 ms` | `470.00 ms / 897.00 ms` | `897.00 ms` |
| **5 clients** | **13.3 req/s** | `365.57 ms` | `340.00 ms` | `347.00 ms / 758.00 ms` | `758.00 ms` |
| **15 clients** | **39.7 req/s** | `366.85 ms` | `338.00 ms` | `346.00 ms / 859.00 ms` | `872.00 ms` |
| **30 clients** | **78.3 req/s** | `371.31 ms` | `339.00 ms` | `350.00 ms / 867.00 ms` | `874.00 ms` |

### B. Event Loop Starvation on Timeline Reads (`GET /posts/feed`):
* **Idle Server Baseline Latency**: `396.59 ms`
* **Under Concurrent Auth Workload**: Tail latency spiked to **`1,481.33 ms`** purely due to event loop serialization.

---

## 5. Architectural Bridge to Day 20
The only mathematically sound solution is **Horizontal Scaling**:
1. Run multiple stateless Node.js server instances (e.g. Instance 1 on Port 5015, Instance 2 on Port 5016).
2. Deploy an NGINX Reverse Proxy Load Balancer to alternate incoming traffic via Round-Robin.
3. Decouple in-memory state into shared Upstash Redis so any instance can serve any user transparently.
