const express = require('express');
const rateLimiter = require('../../lib/rateLimiter');
const logger = require('../../lib/logger');
const redis = require('../../lib/redis');

function registerRoutes(app) {
  const router = express.Router();

  // Return rate limiter stats
  router.get('/admin/ratelimits', async (req, res) => {
    try {
      const prefix = req.query.prefix || '';
      const stats = await rateLimiter.getStats(prefix);
      res.json({ success: true, stats });
    } catch (err) {
      logger.error('admin/ratelimits failed', { err: err.message });
      res.status(500).json({ success: false });
    }
  });

  // TEMP debug: list redis keys and values (only for local debugging)
  router.get('/admin/debug/redis-keys', async (req, res) => {
    try {
      const pattern = req.query.pattern || '*';
      if (redis) {
        const keys = await redis.keys(pattern);
        const multi = redis.multi();
        keys.forEach(k => { multi.get(k); multi.ttl(k); });
        const reply = await multi.exec();
        const out = keys.map((k, i) => ({ key: k, value: reply[i*2][1], ttl: reply[i*2+1][1] }));
        return res.json({ success: true, keys: out });
      }

      // fallback to rateLimiter stats for mem mode
      const prefix = req.query.prefix || '';
      const stats = await rateLimiter.getStats(prefix);
      return res.json({ success: true, keys: stats });
    } catch (err) {
      logger.error('admin/debug/redis-keys failed', { err: err.message });
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.use('/api', router);
}

module.exports = { registerRoutes };
