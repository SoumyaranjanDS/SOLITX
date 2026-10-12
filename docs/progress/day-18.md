# Day 18: Post Lifecycle, Cursor-Based Feed & Social Graph Architecture

## Goal
Implement the end-to-end Post Module and Social Graph: post creation, cursor-based timeline feeds, post editing with timestamp tracking, cascading deletions, atomic likes, and follow relationships.

## The Architecture

### 1. Cursor-Based Pagination vs Offset Drift
Traditional pagination uses `LIMIT 20 OFFSET 1000`. In high-velocity social networks, offset pagination suffers from two critical flaws:
* **Offset Drift:** As new posts are published, page windows shift, causing users to see duplicate posts or miss new items during pagination.
* **Database Degradation:** `OFFSET N` forces PostgreSQL to scan and discard `N` rows before returning 20 records (O(N) cost).

**SOLITX Solution:**
We use cursor pagination based on `created_at` timestamps using our compound index `idx_posts_user_id_created_at`:
```sql
SELECT p.id, p.content, p.created_at, u.username,
  (SELECT COUNT(*)::int FROM likes l WHERE l.post_id = p.id) as likes_count,
  EXISTS(SELECT 1 FROM likes l WHERE l.post_id = p.id AND l.user_id = $userId) as has_liked
FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.created_at < $cursor
ORDER BY p.created_at DESC
LIMIT 20;
```
This query executes in O(log N) regardless of whether there are 100 or 10,000,000 posts in the database.

### 2. Post CRUD & Authorization
* **Create (`POST /api/v1/posts`):** Authenticated via JWT bearer token. Enforces 1–500 character bounds.
* **Edit (`PUT /api/v1/posts/:id`):** Strict author ownership verification (`req.user.id === post.user_id`). Updates `updated_at` to display an *(edited)* badge on the client.
* **Delete (`DELETE /api/v1/posts/:id`):** Cascading foreign key constraint removes all dependent `likes` rows in PostgreSQL automatically.

### 3. Atomic Like Toggle & Optimistic UI
Likes are managed via atomic queries on the `likes` table with a composite primary key `(user_id, post_id)`:
```sql
INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;
```
On the frontend, the heart icon toggles and increments immediately without waiting for server response. If the network call fails, the state automatically rolls back.

### 4. Social Graph (Follows & Recommendations)
* Implemented `follows (follower_id, following_id)` with real-time count recalculation.
* Added `/api/v1/users/suggestions` to populate the right-sidebar "Who to follow" section with live accounts.

## Outcome
Full real-time engagement loop: post creation, editing, deletion, liking, following, and infinite scroll feed.
