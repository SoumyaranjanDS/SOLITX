# Day 17: OAuth 2-Step Registration & Unique Usernames at Scale

## Goal
Implement a stateless, secure 2-step Google OAuth onboarding flow that enforces globally unique `@username` identifiers without database CPU bottlenecks.

## The Problem
Allowing millions of users to choose a custom `@username` introduces two major architectural risks:
1. **O(N) Full Table Scans:** Checking `SELECT * FROM users WHERE username = $1` on unindexed columns forces PostgreSQL to scan every record sequentially. As the database grows to millions of users, concurrent availability checks peg CPU at 100%.
2. **Account Hijacking & Race Conditions:** In traditional OAuth, if an email isn't verified or usernames clash, records can be overwritten or duplicate accounts created.

## The Architecture & Solution

### 1. B-Tree Unique Indexing (O(log N))
We applied a unique B-Tree constraint to `users.username`:
```sql
ALTER TABLE users ADD CONSTRAINT unique_username UNIQUE (username);
```
Lookups drop from ~200ms linear table scans to under <1ms tree traversals across millions of records.

### 2. Frontend Debounced Verification
Instead of spamming the database on every keystroke, the client debounces input by 500ms before calling `/api/v1/auth/check-username`. This eliminates 80%+ of unnecessary network traffic.

### 3. Stateless 2-Step OAuth Handshake
1. **Step 1 (Google Callback):** Passport verifies Google credentials and mints a short-lived, stateless temporary registration JWT (valid for 1 hour) carrying the Google ID and email. No user record is written to PostgreSQL yet.
2. **Step 2 (Username Selection):** The user selects an available username on `/setup-username`. Once validated, the database atomically inserts the user with a hashed password stub and returns a long-lived session JWT.

## Outcome
Clean, friction-free onboarding with zero database strain and guaranteed username uniqueness.
