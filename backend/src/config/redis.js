import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isTls = redisUrl.startsWith('rediss://');

const redis = new Redis(redisUrl, {
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
  maxRetriesPerRequest: 3,
  connectTimeout: 5000,
});

redis.on('connect', () => {
  console.log(`Connected to Redis successfully (${isTls ? 'TLS/Cloud' : 'Local/Direct'})`);
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err.message);
});

export default redis;
