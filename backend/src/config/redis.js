import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const redis = new Redis(process.env.REDIS_URL, {
  // Upstash requires TLS natively over the rediss:// protocol
  tls: {
    rejectUnauthorized: false
  }
});

redis.on('connect', () => {
  console.log('Connected to Upstash Redis successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

export default redis;
