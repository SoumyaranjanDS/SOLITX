import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// DAY 21: Connection Budgeting Under Multiple Instances
// In Day 9, a single instance used max: 100.
// Under Day 19/20 horizontal scaling with dual instances (solitx-api-1 and solitx-api-2),
// unbudgeted pools would open 2 * 100 = 200 connections, risking connection exhaustion.
// We budget the pool per instance using DB_POOL_MAX (default: 25) so:
// 2 instances * 25 = 50 total connections, safely below PostgreSQL limits while leaving
// headroom for admin tasks, workers, and migrations.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: parseInt(process.env.DB_POOL_MAX || '25', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log(`Database connected successfully to PostgreSQL (pool max: ${pool.options.max})`);
    client.release();
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

export default pool;
