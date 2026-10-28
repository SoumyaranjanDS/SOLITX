import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const isTls = redisUrl.startsWith('rediss://');

const redis = new Redis(redisUrl, {
  ...(isTls ? { tls: { rejectUnauthorized: false } } : {}),
  maxRetriesPerRequest: 1, // Fail fast: do not retry 20 times per command
  connectTimeout: 2000,    // 2s connection timeout limit
  enableOfflineQueue: false, // CRITICAL: Never hold HTTP requests in memory if Redis is down! Fail fast to DB fallback
  lazyConnect: false,
  retryStrategy(times) {
    return Math.min(times * 500, 3000);
  },
});

redis.on('connect', () => {
  console.log(`Connected to Redis successfully (${isTls ? 'TLS/Cloud' : 'Local/Direct'})`);
});

redis.on('error', (err) => {
  console.warn('[Redis] Connection notice:', err.message);
});

export default redis;
