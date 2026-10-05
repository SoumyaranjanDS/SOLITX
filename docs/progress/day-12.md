# Day 12: The Repeated Reads Problem

## Goal
Identify the second major architectural flaw that necessitates an In-Memory Datastore: Database Repeated Reads.

## The Flaw
When a highly popular user (like Cristiano Ronaldo) posts on SOLITX, millions of users will click on their profile.
Our current architecture will execute:
```sql
SELECT * FROM users WHERE username = 'cristiano';
```
10 million times in one hour. 

Because Ronaldo's profile data (name, bio, follower count) does not change often, these 10 million reads are completely redundant. We are forcing PostgreSQL to parse the query, search the index, and perform disk/buffer I/O millions of times for the exact same static payload. This will instantly max out the Database CPU and crash the system.

## The Solution Requirements
We must implement the **Cache-Aside Pattern**.
We need a layer of extremely fast RAM sitting between the Node.js Backend and the PostgreSQL Database.

1. **Check:** Node asks the cache: "Do you have `user:cristiano`?"
2. **Hit:** If yes, return it instantly in 1ms.
3. **Miss:** If no, Node queries PostgreSQL.
4. **Save:** Node saves the DB result in the Cache for 5 minutes.

By doing this, PostgreSQL only executes the query 1 time every 5 minutes. The other 9,999,999 requests are handled instantly by RAM.

This fundamentally confirms that we must install **Redis** in Day 13 to serve as our central caching and rate-limiting authority.
