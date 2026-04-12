const redis = require('./redis');
const logger = require('./logger');

// In-memory fallback
const memBuckets = new Map();

function makeKey(prefix, id) {
  return `${prefix}:${id}`;
}

/**
 * Middleware factory: options { prefix, windowSec, max }
 * Uses IP for unauthenticated endpoints (req.ip) or a provided identifier on req (req.user?.uid)
 */
function rateLimiter({ prefix = 'rl', windowSec = 60, max = 10 } = {}) {
  return async function (req, res, next) {
    try {
      const id = (req.user && req.user.uid) ? req.user.uid : req.ip || req.headers['x-forwarded-for'] || 'anon';
      const key = makeKey(prefix, id);

      if (redis) {
        logger.info('rateLimiter: using redis', { key, prefix, id });
        // Use INCR and set EXPIRE when key is new
        const multi = redis.multi();
        multi.incr(key);
        multi.ttl(key);
        const [[, count], [, ttl]] = await multi.exec();
        const current = count;
        logger.info('rateLimiter: redis result', { key, count: current, ttl });
        if (ttl === -1) {
          // set expiry
          await redis.expire(key, windowSec);
        }
        if (current > max) {
          res.status(429).json({ error: 'rate_limited' });
          return;
        }
        return next();
      }

      // In-memory fallback (approximate)
      const now = Date.now();
      const bucket = memBuckets.get(key) || { count: 0, resetAt: now + windowSec * 1000 };
      if (now > bucket.resetAt) {
        bucket.count = 1;
        bucket.resetAt = now + windowSec * 1000;
      } else {
        bucket.count++;
      }
      memBuckets.set(key, bucket);
      if (bucket.count > max) {
        res.status(429).json({ error: 'rate_limited' });
        return;
      }
      return next();
    } catch (err) {
      logger.warn('rateLimiter error, allowing request', { err: err.message });
      return next();
    }
  };
}

async function getStats(prefix = '') {
  const out = [];
  try {
    if (redis) {
      const keys = await redis.keys(`${prefix}:*`);
      if (keys.length === 0) return out;
      const multi = redis.multi();
      keys.forEach(k => { multi.get(k); multi.ttl(k); });
      const res = await multi.exec();
      for (let i = 0; i < keys.length; i++) {
        const count = res[i*2][1];
        const ttl = res[i*2+1][1];
        out.push({ key: keys[i], count: parseInt(count || '0'), ttl });
      }
      return out;
    }

    // mem fallback
    for (const [k, v] of memBuckets.entries()) {
      if (!prefix || k.startsWith(`${prefix}:`)) {
        const remaining = v.resetAt ? Math.max(0, Math.floor((v.resetAt - Date.now())/1000)) : null;
        out.push({ key: k, count: v.count, ttl: remaining });
      }
    }
    return out;
  } catch (err) {
    logger.warn('getStats failed', { err: err.message });
    return out;
  }
}

module.exports = rateLimiter;
module.exports.getStats = getStats;
