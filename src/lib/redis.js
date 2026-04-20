const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();

let redis = null;

const redisUrl =
  process.env.REDIS_URL ||
  process.env.REDIS_PRIVATE_URL ||
  process.env.REDIS_PUBLIC_URL ||
  process.env.RAILWAY_REDIS_URL ||
  '';
const isPlaceholder =
  redisUrl.includes('your_upstash_endpoint') ||
  redisUrl.includes('YOUR_ACTUAL_PASSWORD') ||
  redisUrl.includes('YOUR_ENDPOINT') ||
  redisUrl.endsWith('PORT');
const isValidScheme = /^rediss?:\/\//i.test(redisUrl);
const isInvalidUrl = !redisUrl || isPlaceholder || !isValidScheme;

if (!isInvalidUrl) {
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        // Exponential backoff with a max of 2 seconds
        return Math.min(times * 50, 2000);
      }
    });

    redis.on('connect', () => {
      console.log('✅ Redis connected successfully');
    });

    redis.on('error', (err) => {
      console.warn('⚠️ Redis connection error:', err.message);
    });
  } catch (error) {
    console.warn('❌ Failed to initialize Redis:', error.message);
  }
} else {
  console.warn('⚠️ Redis URL not configured properly (REDIS_URL/REDIS_PRIVATE_URL/REDIS_PUBLIC_URL). Running without Redis caching & locks.');
}

module.exports = redis;