const redis = require('./redis');
const logger = require('./logger');

// In-memory fallback cache for environments without Redis
const memCache = new Map();

async function get(key) {
  if (redis) {
    try {
      const v = await redis.get(key);
      return v ? JSON.parse(v) : null;
    } catch (e) {
      logger.warn('cache.get redis error', { key, err: e.message });
      return null;
    }
  }

  const entry = memCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return entry.value;
}

async function set(key, value, ttlSec = 60) {
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSec);
      return true;
    } catch (e) {
      logger.warn('cache.set redis error', { key, err: e.message });
      return false;
    }
  }

  const expiresAt = ttlSec ? Date.now() + ttlSec * 1000 : null;
  memCache.set(key, { value, expiresAt });
  return true;
}

async function del(key) {
  if (redis) {
    try {
      await redis.del(key);
      return true;
    } catch (e) {
      logger.warn('cache.del redis error', { key, err: e.message });
      return false;
    }
  }
  memCache.delete(key);
  return true;
}

async function memoize(key, ttlSec, fn) {
  const cached = await get(key);
  if (cached) return cached;
  const val = await fn();
  await set(key, val, ttlSec);
  return val;
}

module.exports = { get, set, del, memoize };
