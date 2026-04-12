const Redis = require('ioredis');
const dotenv = require('dotenv');

dotenv.config();

let redis = null;

if (process.env.REDIS_URL && !process.env.REDIS_URL.includes('your_upstash_endpoint')) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
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
  console.warn('⚠️ REDIS_URL not configured properly. Running without Redis caching & locks.');
}

module.exports = redis;