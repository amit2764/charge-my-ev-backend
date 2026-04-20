const express = require('express');
const multer = require('multer');
const { db, mockMode } = require('../../lib/firestore');
const redis = require('../../lib/redis');
const { encode, neighbors, haversineDistance } = require('../../lib/geohash');
const logger = require('../../lib/logger');
const { uploadImage } = require('../../storage');
const { normalizeSchedule, isChargerAvailableNow, getNextAvailable } = require('../../utils/scheduleUtils');
const { requireAuth } = require('../../middleware/auth');

const MAX_CHARGERS_PER_HOST = Number(process.env.MAX_CHARGERS_PER_HOST || 5);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 4 }
});

const DEFAULT_SCHEDULE = {
  mon: { available: false, start: '09:00', end: '21:00' },
  tue: { available: false, start: '09:00', end: '21:00' },
  wed: { available: false, start: '09:00', end: '21:00' },
  thu: { available: false, start: '09:00', end: '21:00' },
  fri: { available: false, start: '09:00', end: '21:00' },
  sat: { available: false, start: '09:00', end: '21:00' },
  sun: { available: false, start: '09:00', end: '21:00' }
};

// Utility: choose geohash precision by radius (km)
function precisionForRadiusKm(radiusKm) {
  if (radiusKm <= 0.6) return 7;
  if (radiusKm <= 2.4) return 6;
  if (radiusKm <= 20) return 5;
  return 4;
}

function toConnectorType(value) {
  return String(value || '').trim().toLowerCase();
}

function toAvailability(host) {
  if (typeof host.available === 'boolean') return host.available;
  const availability = String(host.availability || '').toUpperCase();
  return availability === 'AVAILABLE';
}

function toPricePerUnit(host) {
  if (Number.isFinite(Number(host.pricePerUnit))) return Number(host.pricePerUnit);
  if (Number.isFinite(Number(host.price))) return Number(host.price);
  return 0;
}

function toPowerKw(host) {
  if (Number.isFinite(Number(host.powerKw))) return Number(host.powerKw);
  if (Number.isFinite(Number(host.kw))) return Number(host.kw);
  return 0;
}

function parseExistingPhotos(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // ignore
  }
  return [];
}

function normalizePricingMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'per kwh' || normalized === 'per hour' || normalized === 'flat') return normalized;
  return 'per hour';
}

async function createCharger(req, res) {
  try {
    const hostId = String(req.body?.hostId || '').trim();
    if (!hostId) {
      return res.status(400).json({ success: false, error: 'hostId is required' });
    }

    if (!db || mockMode) {
      return res.json({ success: true, charger: { id: `charger_${Date.now()}`, hostId } });
    }

    const existing = await db.collection('chargers').where('hostId', '==', hostId).limit(MAX_CHARGERS_PER_HOST + 1).get();
    if (existing.size >= MAX_CHARGERS_PER_HOST) {
      return res.status(400).json({ success: false, error: `Host cannot have more than ${MAX_CHARGERS_PER_HOST} chargers` });
    }

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, error: 'lat and lng are required' });
    }

    const connectorType = String(req.body?.connectorType || '').trim();
    const powerKw = Number(req.body?.powerKw);
    const price = Number(req.body?.price);
    const pricingMode = normalizePricingMode(req.body?.pricingMode);
    const address = String(req.body?.address || '').trim();
    const description = String(req.body?.description || '').trim();

    if (!connectorType || !Number.isFinite(powerKw) || !Number.isFinite(price) || !address) {
      return res.status(400).json({ success: false, error: 'connectorType, powerKw, price, address are required' });
    }

    const files = Array.isArray(req.files) ? req.files.slice(0, 4) : [];
    const photos = [];
    for (const file of files) {
      const url = await uploadImage(file, `chargers/${hostId}/`);
      photos.push(url);
    }

    const nowIso = new Date().toISOString();
    const chargerRef = db.collection('chargers').doc();
    const charger = {
      id: chargerRef.id,
      hostId,
      connectorType,
      powerKw,
      pricingMode,
      price,
      address,
      lat,
      lng,
      geohash: encode(lat, lng, 6),
      photos,
      description,
      available: true,
      online: false,
      rating: 0,
      totalSessions: 0,
      schedule: DEFAULT_SCHEDULE,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await chargerRef.set(charger);
    return res.status(201).json({ success: true, charger });
  } catch (error) {
    logger.error('matching.createCharger error', { error: error.message });
    return res.status(500).json({ success: false, error: 'internal' });
  }
}

async function updateCharger(req, res) {
  try {
    const chargerId = String(req.params?.id || '').trim();
    if (!chargerId) return res.status(400).json({ success: false, error: 'charger id is required' });

    if (!db || mockMode) return res.json({ success: true, charger: { id: chargerId } });

    const ref = db.collection('chargers').doc(chargerId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'charger not found' });
    const current = snap.data();

    const lat = Number(req.body?.lat);
    const lng = Number(req.body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ success: false, error: 'lat and lng are required' });
    }

    const newPhotos = Array.isArray(req.files) ? req.files.slice(0, 4) : [];
    const uploaded = [];
    for (const file of newPhotos) {
      const url = await uploadImage(file, `chargers/${current.hostId}/`);
      uploaded.push(url);
    }

    const existingPhotos = parseExistingPhotos(req.body?.existingPhotos);
    const photos = [...existingPhotos, ...uploaded].slice(0, 4);

    const updates = {
      connectorType: String(req.body?.connectorType || current.connectorType || '').trim(),
      powerKw: Number(req.body?.powerKw),
      pricingMode: normalizePricingMode(req.body?.pricingMode),
      price: Number(req.body?.price),
      address: String(req.body?.address || '').trim(),
      lat,
      lng,
      geohash: encode(lat, lng, 6),
      photos,
      description: String(req.body?.description || ''),
      updatedAt: new Date().toISOString()
    };

    if (!updates.connectorType || !Number.isFinite(updates.powerKw) || !Number.isFinite(updates.price) || !updates.address) {
      return res.status(400).json({ success: false, error: 'connectorType, powerKw, price, address are required' });
    }

    await ref.update(updates);
    const updated = { ...current, ...updates, id: chargerId };
    return res.json({ success: true, charger: updated });
  } catch (error) {
    logger.error('matching.updateCharger error', { error: error.message });
    return res.status(500).json({ success: false, error: 'internal' });
  }
}

async function toggleCharger(req, res) {
  try {
    const chargerId = String(req.params?.id || '').trim();
    const hostId = String(req.body?.hostId || '').trim();
    const online = !!req.body?.online;

    if (!chargerId || !hostId) {
      return res.status(400).json({ success: false, error: 'charger id and hostId are required' });
    }

    if (!db || mockMode) return res.json({ success: true, online });

    const ref = db.collection('chargers').doc(chargerId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'charger not found' });
    const current = snap.data();
    if (String(current.hostId) !== hostId) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    await ref.update({ online, updatedAt: new Date().toISOString() });
    return res.json({ success: true, online });
  } catch (error) {
    logger.error('matching.toggleCharger error', { error: error.message });
    return res.status(500).json({ success: false, error: 'internal' });
  }
}

async function saveSchedule(req, res) {
  try {
    const chargerId = String(req.params?.id || '').trim();
    const hostId = String(req.body?.hostId || '').trim();
    const incoming = req.body?.schedule || {};

    if (!chargerId || !hostId) {
      return res.status(400).json({ success: false, error: 'charger id and hostId are required' });
    }

    const schedule = normalizeSchedule(incoming);
    if (!db || mockMode) {
      return res.json({ success: true, schedule });
    }

    const ref = db.collection('chargers').doc(chargerId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'charger not found' });
    const current = snap.data();
    if (String(current.hostId) !== hostId) {
      return res.status(403).json({ success: false, error: 'forbidden' });
    }

    await ref.update({ schedule, updatedAt: new Date().toISOString() });
    return res.json({ success: true, schedule });
  } catch (error) {
    logger.error('matching.saveSchedule error', { error: error.message });
    return res.status(500).json({ success: false, error: 'internal' });
  }
}

async function listMine(req, res) {
  try {
    const hostId = String(req.query?.hostId || '').trim();
    if (!hostId) return res.status(400).json({ success: false, error: 'hostId is required' });

    if (!db || mockMode) return res.json({ success: true, chargers: [] });

    const snap = await db.collection('chargers').where('hostId', '==', hostId).orderBy('createdAt', 'desc').limit(MAX_CHARGERS_PER_HOST).get();
    const chargers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, chargers });
  } catch (error) {
    logger.error('matching.listMine error', { error: error.message });
    return res.status(500).json({ success: false, error: 'internal' });
  }
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

async function nearbyHosts(req, res) {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radiusKm = parseFloat(req.query.radiusKm) || 5;
    const connectorType = toConnectorType(req.query.connectorType);
    const minKw = req.query.minKw !== undefined ? Number(req.query.minKw) : null;
    const maxPrice = req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : null;

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'lat,lng required' });
    }

    const precision = precisionForRadiusKm(radiusKm);
    const centerHash = encode(lat, lng, precision);
    const prefixes = neighbors(centerHash).concat([centerHash]);

    if (!db || mockMode) {
      const sample = [
        {
          hostId: 'host_demo_001',
          name: 'Demo Host',
          rating: 4.8,
          distance: 0.7,
          pricePerUnit: 12,
          connectorType: 'CCS2',
          powerKw: 30,
          available: true,
          location: { lat, lng }
        }
      ];
      return res.json({ success: true, hosts: sample });
    }

    const snapshots = await Promise.all(
      prefixes.map((p) =>
        db.collection('chargers')
          .where('geohash', '>=', p)
          .where('geohash', '<=', `${p}\uf8ff`)
          .limit(80)
          .get()
      )
    );

    const byChargerId = new Map();

    for (const snap of snapshots) {
      snap.forEach((doc) => {
        if (byChargerId.has(doc.id)) return;

        const data = doc.data() || {};
        if (!Number.isFinite(Number(data.lat)) || !Number.isFinite(Number(data.lng))) {
          return;
        }

        if (!data.online) return;

        const schedule = normalizeSchedule(data.schedule || DEFAULT_SCHEDULE);
        const availableNow = isChargerAvailableNow(schedule);
        const nextAvailable = getNextAvailable(schedule);

        const distance = haversineDistance(lat, lng, Number(data.lat), Number(data.lng));
        if (distance > radiusKm) return;

        const hostConnectorType = String(data.connectorType || '').trim();
        const normalizedConnectorType = toConnectorType(hostConnectorType);
        const powerKw = toPowerKw(data);
        const pricePerUnit = toPricePerUnit(data);
        const available = !!data.available && availableNow;

        if (connectorType && normalizedConnectorType !== connectorType) return;
        if (minKw !== null && Number.isFinite(minKw) && powerKw < minKw) return;
        if (maxPrice !== null && Number.isFinite(maxPrice) && pricePerUnit > maxPrice) return;

        byChargerId.set(doc.id, {
          chargerId: doc.id,
          hostId: data.hostId,
          name: String(data.name || 'Host Charger'),
          rating: Number.isFinite(Number(data.rating)) ? Number(data.rating) : 4.5,
          distance: Number(distance.toFixed(2)),
          pricePerUnit,
          connectorType: hostConnectorType || 'Unknown',
          powerKw,
          available,
          availableNow,
          nextAvailable,
          schedule,
          location: {
            lat: Number(data.lat),
            lng: Number(data.lng)
          }
        });
      });
    }

    const hosts = Array.from(byChargerId.values()).sort((a, b) => a.distance - b.distance).slice(0, 50);

    const hostIds = [...new Set(hosts.map((host) => String(host.hostId || '').trim()).filter(Boolean))];
    const kycByHostId = new Map();

    await Promise.all(hostIds.map(async (hostId) => {
      try {
        const userSnap = await db.collection('users').doc(hostId).get();
        const kycStatus = String(userSnap.data()?.kyc?.status || 'UNVERIFIED').toUpperCase();
        kycByHostId.set(hostId, kycStatus);
      } catch {
        kycByHostId.set(hostId, 'UNVERIFIED');
      }
    }));

    const hostsWithKyc = hosts.map((host) => {
      const kycStatus = kycByHostId.get(String(host.hostId || '').trim()) || 'UNVERIFIED';
      return {
        ...host,
        kycStatus,
        verified: kycStatus === 'VERIFIED'
      };
    });

    return res.json({ success: true, hosts: hostsWithKyc });
  } catch (error) {
    logger.error('matching.nearbyHosts error', { error: error.message });
    return res.status(500).json({ success: false, error: 'internal' });
  }
}

function registerRoutes(app) {
  const router = express.Router();
  router.post('/chargers', requireAuth, upload.array('photos', 4), createCharger);
  router.put('/chargers/:id', requireAuth, upload.array('photos', 4), updateCharger);
  router.put('/chargers/:id/schedule', requireAuth, saveSchedule);
  router.patch('/chargers/:id/toggle', requireAuth, toggleCharger);
  router.get('/chargers/mine', requireAuth, listMine);
  router.get('/chargers/nearby', nearby);   // public — unauthenticated search is fine
  router.get('/hosts/nearby', nearbyHosts); // public
  app.use('/api', router);
}

module.exports = { registerRoutes };
