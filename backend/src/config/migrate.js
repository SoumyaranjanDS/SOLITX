import pool from "./db.js";

const runMigrations = async () => {
  const createUsersTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      bio TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    console.log("Starting database migrations...");

    await pool.query(createUsersTableQuery);

    console.log("'users' table created/verified successfully!");
  } catch (error) {
    console.error("Migration failed:", error.message);
  } finally {
    process.exit(0);
  }
};

runMigrations();
