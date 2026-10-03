# Day 06: Design the Data Model
**Status**: Completed

Built:
- Designed and migrated PostgreSQL tables: `users`, `posts`, `follows`, `likes`.
- Enforced data integrity via Database Constraints instead of application logic.

Learned:
- **Ghost Posts:** Solved using `FOREIGN KEY` + `ON DELETE CASCADE`. Wipes posts automatically when a user is deleted.
- **Infinite Follow Bug:** Solved using `UNIQUE` Constraints on Junction Tables (`PRIMARY KEY (follower_id, following_id)`). Prevents duplicate records mechanically.

Next problem:
The tables exist and data integrity is guaranteed. But currently, finding posts for a specific user requires reading every single row in the database from top to bottom (Sequential Scan). We need to implement Database Indexing to speed up reads.
