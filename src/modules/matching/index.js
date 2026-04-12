const express = require('express');
const { db, mockMode } = require('../../lib/firestore');
const redis = require('../../lib/redis');
const { encode, neighbors, haversineDistance } = require('../../lib/geohash');
const logger = require('../../lib/logger');

// Utility: choose geohash precision by radius (km)
function precisionForRadiusKm(radiusKm) {
  if (radiusKm <= 0.6) return 7;
  if (radiusKm <= 2.4) return 6;
  if (radiusKm <= 20) return 5;
  return 4;
}

async function nearby(req, res) {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = parseFloat(req.query.radius) || 5;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'lat,lng required' });
    }

    const cacheKey = `nearby:${lat.toFixed(4)}:${lng.toFixed(4)}:${radiusKm}`;
    const cache = require('../../lib/cache');
    const cached = await cache.get(cacheKey);
    if (cached) {
      logger.info('matching:cache:hit', { key: cacheKey });
      return res.json({ success: true, stations: cached });
    }

    // Mock mode fallback: return sample stations for dev
    if (!db || mockMode) {
      const sample = [
        {
          id: 'station_001',
          name: 'Mock Station',
          location: { lat, lng },
          distanceKm: 0
        }
      ];
      if (redis) await redis.set(cacheKey, JSON.stringify(sample), 'EX', 60);
      return res.json({ success: true, stations: sample });
    }

    const precision = precisionForRadiusKm(radiusKm);
    const centerHash = encode(lat, lng, precision);
    const prefixes = neighbors(centerHash).concat([centerHash]);

    // Query promises per prefix
    const promises = prefixes.map(p =>
      db.collection('hosts')
        .where('geohash', '>=', p)
        .where('geohash', '<=', p + '\uf8ff')
        .limit(50)
        .get()
    );

    const snapshots = await Promise.all(promises);
    const hosts = [];
    for (const snap of snapshots) {
      snap.forEach(doc => {
        const data = doc.data();
        if (!data.location) return;
        const d = haversineDistance(lat, lng, data.location.lat, data.location.lng);
        if (d <= radiusKm) {
          hosts.push({ id: doc.id, ...data, distanceKm: d });
        }
      });
    }

    // sort by distance and limit
    hosts.sort((a,b) => a.distanceKm - b.distanceKm);
    const result = hosts.slice(0, 20);

    try { await cache.set(cacheKey, result, 60); } catch (e) { logger.warn('cache set failed', { err: e.message }); }

    return res.json({ success: true, stations: result });
  } catch (error) {
    logger.error('matching.nearby error', { error: error.message });
    return res.status(500).json({ success: false, error: 'internal' });
  }
}

function registerRoutes(app) {
  const router = express.Router();
  router.get('/chargers/nearby', nearby);
  app.use('/api', router);
}

module.exports = { registerRoutes };
