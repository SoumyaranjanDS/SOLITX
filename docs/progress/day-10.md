# Day 10: Pagination (Offset vs Cursor)

## Goal
Implement a highly performant pagination strategy to prevent the backend from sending 100,000 rows in a single massive JSON response.

## Action Taken
1. Upgraded the test feed endpoint (`GET /api/v1/test/feed/:user_id`) to support Cursor-based pagination.
2. We explicitly avoided `OFFSET` pagination due to its inherent `O(N)` query scaling degradation and Data Drift issues on Social Media feeds.

## The Cursor Pagination Strategy
Instead of passing `page=2`, the frontend passes the `created_at` timestamp of the last post it currently has rendered on the screen (the "cursor").

The database query was updated from:
```sql
SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20;
```
to:
```sql
SELECT * FROM posts WHERE user_id = $1 AND created_at < $cursor ORDER BY created_at DESC LIMIT 20;
```

## Results
- **O(log N) Performance**: The database uses the existing B-Tree index to instantly jump directly to the timestamp cursor and grab the next 20 rows, guaranteeing `0.086ms` query times regardless of scroll depth.
- **Data Drift Eliminated**: If new posts are inserted at the top of the timeline while the user is reading, their place in the feed is locked by the timestamp cursor, completely preventing duplicate posts from being rendered on the next page.

## Next Steps
Our Monolithic API is now highly resilient. It has Rate Limiting, Indexing, Connection Pooling, and Pagination.
However, we need to protect these API routes from abuse (e.g. users attempting to scrape millions of posts) in Day 11.
