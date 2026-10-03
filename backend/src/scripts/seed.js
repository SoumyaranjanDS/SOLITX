import pool from "../config/db.js";

async function seed() {
  console.log("Starting DB seed. This might take a minute...");
  try {
    // 1. Create a main test user we will search for later
    const userRes = await pool.query(`
      INSERT INTO users (username, email, password_hash) 
      VALUES ('test_indexer', 'test@index.com', 'dummy_hash')
      ON CONFLICT (username) DO NOTHING
      RETURNING id;
    `);
    
    let testUserId;
    if (userRes.rows.length > 0) {
      testUserId = userRes.rows[0].id;
    } else {
      // If user already exists, fetch their ID
      const existing = await pool.query(`SELECT id FROM users WHERE username = 'test_indexer'`);
      testUserId = existing.rows[0].id;
    }
    
    console.log(`Test user ID: ${testUserId}`);

    // 2. Create 50 other dummy users to dilute the data
    console.log("Creating dummy users...");
    const otherUserIds = [];
    for (let i = 0; i < 50; i++) {
       const u = await pool.query(`
         INSERT INTO users (username, email, password_hash) 
         VALUES ('user_seed_${i}', 'user_seed${i}@mail.com', 'dummy_hash')
         ON CONFLICT (username) DO NOTHING
         RETURNING id;
       `);
       if (u.rows.length > 0) {
           otherUserIds.push(u.rows[0].id);
       }
    }
    
    // Fetch them all just in case of conflicts
    const allUsers = await pool.query(`SELECT id FROM users WHERE username LIKE 'user_seed_%'`);
    const allUserIds = [testUserId, ...allUsers.rows.map(r => r.id)];

    // 3. Insert 100,000 posts in batches of 5000
    const TOTAL_POSTS = 100000;
    const BATCH_SIZE = 5000;
    
    console.log(`Inserting ${TOTAL_POSTS} fake posts in batches...`);
    
    for (let i = 0; i < TOTAL_POSTS; i += BATCH_SIZE) {
      const values = [];
      for (let j = 0; j < BATCH_SIZE; j++) {
        // Randomly pick a user
        const randomUser = allUserIds[Math.floor(Math.random() * allUserIds.length)];
        values.push(`('${randomUser}', 'This is a test post for measuring sequential scans. Post number ${i+j}.')`);
      }
      
      const query = `INSERT INTO posts (user_id, content) VALUES ${values.join(',')};`;
      await pool.query(query);
      console.log(`Inserted batch ${i / BATCH_SIZE + 1} / ${TOTAL_POSTS / BATCH_SIZE}`);
    }

    console.log("Database seeded successfully!");
    console.log(`\n======================================================`);
    console.log(`To see the Sequential Scan, run this EXACT query in your Neon SQL Editor:`);
    console.log(`EXPLAIN ANALYZE SELECT * FROM posts WHERE user_id = '${testUserId}' ORDER BY created_at DESC LIMIT 20;`);
    console.log(`======================================================\n`);

  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    process.exit(0);
  }
}

seed();
