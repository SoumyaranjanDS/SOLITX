import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
});

export const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log(`Database connected successfully to PostgreSQL`);
    client.release();
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

export default pool;
