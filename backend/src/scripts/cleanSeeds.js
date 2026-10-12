import pool from "../config/db.js";
import redis from "../config/redis.js";

async function cleanSeeds() {
  console.log("Cleaning up seeded users and test posts...");
  try {
    // 1. Delete all posts belonging to test content
    const testPostsRes = await pool.query(`
      DELETE FROM posts 
      WHERE content LIKE 'This is a test post for measuring sequential scans%';
    `);
    console.log(`Deleted ${testPostsRes.rowCount} test benchmark posts.`);

    // 2. Delete all seeded users (due to ON DELETE CASCADE, their posts are also wiped)
    const seedUsersRes = await pool.query(`
      DELETE FROM users 
      WHERE username LIKE 'user_seed_%' OR username = 'test_indexer';
    `);
    console.log(`Deleted ${seedUsersRes.rowCount} seeded users (and all associated cascade posts/likes).`);

    // 3. Clear Redis cache
    try {
      const keys = await redis.keys("user:*");
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`Cleared ${keys.length} cached user keys from Redis.`);
      } else {
        console.log("No stale user keys in Redis.");
      }
    } catch (redisErr) {
      console.warn("Redis cleanup warning:", redisErr.message);
    }

    // 4. Print remaining counts
    const usersCount = await pool.query("SELECT COUNT(*) FROM users;");
    const postsCount = await pool.query("SELECT COUNT(*) FROM posts;");

    console.log("\n--- Database Status ---");
    console.log(`Active real users remaining: ${usersCount.rows[0].count}`);
    console.log(`Real posts remaining: ${postsCount.rows[0].count}`);
    console.log("Cleanup completed successfully!");
  } catch (err) {
    console.error("Cleanup error:", err);
  } finally {
    process.exit(0);
  }
}

cleanSeeds();
