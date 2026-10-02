# Day 04: The Foundation
Status: Completed

Built:
- Express modular monolith foundation
- PostgreSQL connection pooling via Neon
- User model and raw SQL migrations
- User registration & login endpoints
- Stateless JWT generation and middleware
- Protected routes
- Vite + React frontend with Swiss Editorial Minimal UI

Learned:
- Authentication vs authorization
- Password hashing mathematics (bcryptjs) vs encryption
- JWT anatomy and stateless verification
- Express centralized error handling patterns

Tested:
- Registration constraints (Duplicate users blocked at DB level)
- Login (Invalid credentials rejected)
- Protected routes (Invalid/missing tokens rejected)
- UI Flow (Login to Feed, Logout)

Next problem:
Now that we have authentication, what happens to our rate of failed logins if a botnet targets the endpoint? How do we protect the database from being overwhelmed by brute-force attacks while running multiple Node instances?
