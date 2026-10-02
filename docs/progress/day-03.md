# Day 03: Capacity Estimation
Status: Completed

Built:
- Back-of-the-envelope capacity planning
- Calculated 20k DAU projections (100:1 read/write ratio)
- Identified 5 million read requests per day
- Formulated peak Request Per Second (RPS) ~200

Learned:
- How to estimate database traffic load before writing code.
- Why microservices are unnecessary for standard read-heavy social media applications below 50,000 DAU.
- How Node.js handles I/O scaling inherently.

Tested:
- Mathematical proof of Monolith viability for V0.

Next problem:
Now that we have proven mathematically that a monolith can handle the load, we need to actually build the engine. We need a robust backend that guarantees data integrity and handles authentication securely.
