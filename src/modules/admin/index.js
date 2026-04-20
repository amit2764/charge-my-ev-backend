const express = require('express');
const rateLimiter = require('../../lib/rateLimiter');
const logger = require('../../lib/logger');
const redis = require('../../lib/redis');
const { db, mockMode } = require('../../lib/firestore');
const { requireAuth, requireAdmin } = require('../../middleware/auth');

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === 'string') {
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  return 0;
}

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getDurationMinutes(booking = {}) {
  const explicit = numberOrZero(booking.durationMinutes || booking.duration);
  if (explicit > 0) return explicit;
  const start = toMillis(booking.startTime);
  const end = toMillis(booking.endTime);
  if (!start || !end || end <= start) return 0;
  return Math.max(1, Math.round((end - start) / 60000));
}

function registerRoutes(app) {
  const router = express.Router();

  // Host earnings dashboard aggregation from completed booking data
  router.get('/host/earnings', requireAuth, async (req, res) => {
    try {
      const hostId = req.user.uid;
      const period = String(req.query.period || 'all').toLowerCase();

      if (!['week', 'month', 'all'].includes(period)) {
        return res.status(400).json({ success: false, error: 'period must be week, month, or all' });
      }

      if (!db || mockMode) {
        return res.json({
          success: true,
          total: 0,
          periodTotal: 0,
          sessionCount: 0,
          avgKwh: 0,
          avgDuration: 0,
          bestCharger: null,
          recentSessions: []
        });
      }

      const snap = await db.collection('bookings')
        .where('hostId', '==', hostId)
        .where('status', '==', 'COMPLETED')
        .orderBy('createdAt', 'desc')
        .limit(300)
        .get();

      const now = Date.now();
      const periodMs = period === 'week'
        ? 7 * 24 * 60 * 60 * 1000
        : period === 'month'
          ? 30 * 24 * 60 * 60 * 1000
          : Number.POSITIVE_INFINITY;

      let total = 0;
      let periodTotal = 0;
      let sessionCount = 0;
      let totalKwh = 0;
      let totalDuration = 0;
      const chargerMap = new Map();

      const recentSessions = [];

      for (const doc of snap.docs) {
        const booking = doc.data() || {};
        const bookingId = doc.id;
        const amount = numberOrZero(booking.finalAmount ?? booking.price);
        const kwh = numberOrZero(booking.energyKwh ?? booking.kwh ?? booking.chargedKwh);
        const duration = getDurationMinutes(booking);
        const createdAtMs = toMillis(booking.createdAt || booking.completedAt);
        const inPeriod = (now - createdAtMs) <= periodMs;

        total += amount;
        sessionCount += 1;
        totalKwh += kwh;
        totalDuration += duration;
        if (inPeriod) periodTotal += amount;

        const chargerId = String(booking.chargerId || booking.charger?.id || 'default');
        const chargerName = booking.chargerName || booking.charger?.name || 'Default Charger';
        const prev = chargerMap.get(chargerId) || { chargerId, chargerName, totalEarnings: 0, sessions: 0 };
        prev.totalEarnings += amount;
        prev.sessions += 1;
        chargerMap.set(chargerId, prev);

        if (recentSessions.length < 20) {
          let userName = 'Unknown user';
          const userId = booking.userId || null;
          if (userId) {
            try {
              const userSnap = await db.collection('users').doc(userId).get();
              if (userSnap.exists) {
                const userData = userSnap.data() || {};
                userName = userData.name || userData.displayName || userData.fullName || userName;
              }
            } catch {
              // Best effort enrichment.
            }
          }

          recentSessions.push({
            id: bookingId,
            date: createdAtMs ? new Date(createdAtMs).toISOString() : null,
            userName,
            amount,
            kwh,
            duration,
            chargerName,
            paymentStatus: String(booking.paymentStatus || booking.payment?.status || 'PENDING').toUpperCase()
          });
        }
      }

      let bestCharger = null;
      for (const value of chargerMap.values()) {
        if (!bestCharger || value.totalEarnings > bestCharger.totalEarnings) {
          bestCharger = value;
        }
      }

      const avgKwh = sessionCount > 0 ? (totalKwh / sessionCount) : 0;
      const avgDuration = sessionCount > 0 ? (totalDuration / sessionCount) : 0;

      return res.json({
        success: true,
        total,
        periodTotal,
        sessionCount,
        avgKwh,
        avgDuration,
        bestCharger,
        recentSessions
      });
    } catch (err) {
      logger.error('host/earnings failed', { err: err.message });
      return res.status(500).json({ success: false, error: 'Failed to load host earnings' });
    }
  });

  // Return rate limiter stats
  router.get('/admin/ratelimits', requireAuth, requireAdmin, async (req, res) => {
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
  router.get('/admin/debug/redis-keys', requireAuth, requireAdmin, async (req, res) => {
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
