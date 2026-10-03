# Day 07: The Database Starts Talking Back
**Status**: Completed

Built:
- Wrote a Node.js seed script to inject 100,000 dummy posts into the database.
- Ran `EXPLAIN ANALYZE` on sequential reads, proving a 5.495 ms execution time and 98,000 rows filtered.
- Created a Composite B-Tree Index on `(user_id, created_at DESC)`.
- Re-ran `EXPLAIN ANALYZE`, proving a 0.086 ms execution time (63x speedup), 0 rows filtered, and 0 heapsorts.

Learned:
- **Sequential Scans**: The database reads every single row in the table from disk and throws away data that doesn't match the filter. Highly destructive at scale.
- **B-Tree Indexes**: Acts like a Table of Contents. Allows the Query Planner to execute an `Index Scan`, jumping directly to the data.
- **Trade-offs**: Indexes consume storage and incur a write-penalty on every `INSERT` operation, requiring careful planning (we don't index everything).

Next problem:
The database logic is perfectly optimized. The monolith is ready. Before we scale or introduce complex pooling, we need to know the baseline performance of our single Node.js server. We need to load test it until it breaks.
