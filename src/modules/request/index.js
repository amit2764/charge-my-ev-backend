const express = require('express');
const { db, mockMode } = require('../../lib/firestore');
const { emitToRequest, emitRequestToNearbyHosts, isHostOnline, getHostMeta } = require('../../realtime');
const { haversineDistance } = require('../../lib/geohash');
const { normalizeSchedule, isChargerAvailableNow, getNextAvailable } = require('../../utils/scheduleUtils');
const { sendPushNotification, getUserDisplayName } = require('../../utils/notify');
const { requireAuth } = require('../../middleware/auth');

const inMemoryRequests = new Map();
const inMemoryResponses = new Map();
const REQUEST_TTL_MS = 5 * 60 * 1000;
const ACCEPTANCE_TTL_MS = 30 * 1000; // 30 seconds for user to confirm booking

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isExpired(expiryIso) {
  return !expiryIso || new Date(expiryIso).getTime() <= Date.now();
}

// If a host accepted but user didn't confirm within 30s, revert request to OPEN
function resetExpiredAcceptances(requestData) {
  if (requestData.acceptedBy && requestData.acceptanceExpiresAt && isExpired(requestData.acceptanceExpiresAt)) {
    requestData.status = 'OPEN';
    requestData.acceptedBy = null;
    requestData.acceptanceExpiresAt = null;
  }
  return requestData;
}

function cleanupExpiredInMemory() {
  for (const [requestId, request] of inMemoryRequests.entries()) {
    if (isExpired(request.expiresAt) || request.status !== 'OPEN') {
      inMemoryRequests.delete(requestId);
    }
  }
}

async function createRequest(req, res) {
  try {
    const { location, vehicleType, chargerId, promoCode } = req.body || {};
    const userId = req.user.uid;
    if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return res.status(400).json({ success: false, error: 'userId and valid location are required' });
    }

    if (chargerId && db && !mockMode) {
      const chargerSnap = await db.collection('chargers').doc(String(chargerId)).get();
      if (!chargerSnap.exists) {
        return res.status(404).json({ success: false, error: 'Selected charger not found' });
      }

      const charger = chargerSnap.data() || {};
      if (!charger.online) {
        return res.status(400).json({
          success: false,
          code: 'OUTSIDE_SCHEDULE',
          nextAvailable: 'Unavailable',
          error: 'Selected charger is offline'
        });
      }

      const schedule = normalizeSchedule(charger.schedule || {});
      const availableNow = isChargerAvailableNow(schedule);
      if (!availableNow) {
        return res.status(400).json({
          success: false,
          code: 'OUTSIDE_SCHEDULE',
          nextAvailable: getNextAvailable(schedule),
          error: 'Selected charger is outside availability window'
        });
      }

      // Block check: reject if the charger's host has blocked this user
      if (charger.hostId && userId) {
        const blockSnap = await db.collection('blocks')
          .where('hostId', '==', charger.hostId)
          .where('blockedUserId', '==', userId)
          .limit(1)
          .get();
        if (!blockSnap.empty) {
          return res.status(403).json({
            success: false,
            code: 'BLOCKED',
            error: 'You are not able to request this charger'
          });
        }
      }

      // Check if user already has an active booking
      const existingUserBookingSnap = await db.collection('bookings')
        .where('userId', '==', userId)
        .where('status', 'in', ['CONFIRMED', 'STARTED'])
        .limit(1)
        .get();
      if (!existingUserBookingSnap.empty) {
        return res.status(409).json({ success: false, error: 'User already has an active booking' });
      }

      // Check if host already has an active booking
      if (charger.hostId) {
        const existingHostBookingSnap = await db.collection('bookings')
          .where('hostId', '==', charger.hostId)
          .where('status', 'in', ['CONFIRMED', 'STARTED'])
          .limit(1)
          .get();
        if (!existingHostBookingSnap.empty) {
          return res.status(409).json({ success: false, error: 'Host charger already has an active booking' });
        }
      }
    }

    if (promoCode && db && !mockMode) {
      const normalizedPromoCode = String(promoCode).trim().toUpperCase();
      const promoSnap = await db.collection('promoCodes').doc(normalizedPromoCode).get();
      if (!promoSnap.exists) {
        return res.status(400).json({ success: false, error: 'Promo code not found' });
      }

      const promo = promoSnap.data() || {};
      if (!promo.active) {
        return res.status(400).json({ success: false, error: 'Promo code is no longer active' });
      }

      const expiresAtMs = promo.expiresAt && typeof promo.expiresAt.toDate === 'function'
        ? promo.expiresAt.toDate().getTime()
        : (promo.expiresAt ? new Date(promo.expiresAt).getTime() : null);
      if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) {
        return res.status(400).json({ success: false, error: 'Promo code has expired' });
      }

      const usedCount = Number(promo.usedCount || 0);
      const maxUses = Number(promo.maxUses || Number.POSITIVE_INFINITY);
      if (usedCount >= maxUses) {
        return res.status(400).json({ success: false, error: 'Promo code usage limit reached' });
      }
    }

    const id = uid('req');
    const request = {
      id,
      userId,
      location,
      chargerId: chargerId || null,
      vehicleType: vehicleType || 'electric',
      promoCode: promoCode ? String(promoCode).trim().toUpperCase() : null,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + REQUEST_TTL_MS).toISOString()
    };

    if (!db || mockMode) {
      cleanupExpiredInMemory();
      inMemoryRequests.set(id, request);
    } else {
      await db.collection('requests').doc(id).set(request);
    }

    emitRequestToNearbyHosts(request);
    return res.json({ success: true, request });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to create request' });
  }
}

async function listPendingRequests(req, res) {
  try {
    const hostId = req.query.hostId;
    const hostLat = req.query.hostLat ? Number(req.query.hostLat) : null;
    const hostLng = req.query.hostLng ? Number(req.query.hostLng) : null;
    const radiusKm = Number(req.query.radiusKm) || 5;

    if (!hostId && (hostLat == null || hostLng == null)) {
      return res.status(400).json({ success: false, error: 'hostId or hostLat/hostLng is required' });
    }

    let pending = [];

    if (!db || mockMode) {
      cleanupExpiredInMemory();
      pending = Array.from(inMemoryRequests.values());
    } else {
      const snap = await db.collection('requests').where('status', '==', 'OPEN').limit(50).get();
      pending = snap.docs.map(doc => doc.data());
    }

    let anchorLocation = null;
    if (hostLat != null && hostLng != null && !Number.isNaN(hostLat) && !Number.isNaN(hostLng)) {
      anchorLocation = { lat: hostLat, lng: hostLng };
    } else if (hostId) {
      const meta = getHostMeta(hostId);
      anchorLocation = meta?.location || null;
    }

    if (!anchorLocation) {
      return res.status(400).json({ success: false, error: 'Host charger location is required' });
    }

    pending = pending
      .filter(r => !isExpired(r.expiresAt))
      .map(r => {
        const distance = haversineDistance(
          Number(anchorLocation.lat),
          Number(anchorLocation.lng),
          Number(r.location.lat),
          Number(r.location.lng)
        );
        return { ...r, distance: Number(distance.toFixed(2)), rating: 4.9 };
      })
      .filter(r => r.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20);

    return res.json({ success: true, requests: pending });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load pending requests' });
  }
}

async function getRequestResponses(req, res) {
  try {
    const requestId = String(req.params?.id || '').trim();
    if (!requestId) {
      return res.status(400).json({ success: false, error: 'requestId is required' });
    }

    if (!db || mockMode) {
      const request = inMemoryRequests.get(requestId) || null;
      const responses = inMemoryResponses.get(requestId) || [];
      return res.json({ success: true, request, responses });
    }

    const requestRef = db.collection('requests').doc(requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const request = resetExpiredAcceptances({ id: requestSnap.id, ...(requestSnap.data() || {}) });
    const responsesSnap = await db.collection('responses')
      .where('requestId', '==', requestId)
      .limit(20)
      .get();

    const responses = responsesSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

    return res.json({ success: true, request, responses });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load request responses' });
  }
}

async function respondToRequest(req, res) {
  try {
    const { requestId, status, price, estimatedArrival, hostLocation } = req.body || {};
    const hostId = req.user.uid;
    if (!requestId) {
      return res.status(400).json({ success: false, error: 'requestId and hostId are required' });
    }
    if (!isHostOnline(hostId)) {
      return res.status(400).json({ success: false, error: 'Host must be online before responding' });
    }

    let request = null;
    let requestRef = null;

    if (!db || mockMode) {
      request = inMemoryRequests.get(requestId);
      if (request) {
        request = resetExpiredAcceptances(request);
      }
    } else {
      requestRef = db.collection('requests').doc(requestId);
      const snap = await requestRef.get();
      request = snap.exists ? snap.data() : null;
      if (request) {
        request = resetExpiredAcceptances(request);
      }
    }

    if (!request || isExpired(request.expiresAt)) {
      return res.status(404).json({ success: false, error: 'Request not found or expired' });
    }

    // ============ KEY LOGIC: First-responder locking (like Uber) ============
    if (request.status === 'RESPONDING' && request.acceptedBy && request.acceptedBy !== hostId) {
      return res.status(409).json({ success: false, error: 'This request was already accepted by another host. Please try another one.' });
    }

    if (request.status !== 'OPEN' && request.status !== 'RESPONDING') {
      return res.status(400).json({ success: false, error: 'Request is no longer available' });
    }

    const resolvedHostLocation = hostLocation || getHostMeta(hostId)?.location;
    if (resolvedHostLocation && request.location) {
      const distance = haversineDistance(
        Number(resolvedHostLocation.lat),
        Number(resolvedHostLocation.lng),
        Number(request.location.lat),
        Number(request.location.lng)
      );
      if (distance > 5) {
        return res.status(400).json({ success: false, error: 'Host is too far from this request (must be within 5km)' });
      }
    }

    // Create response record
    const response = {
      id: uid('resp'),
      requestId,
      hostId,
      status: status || 'ACCEPTED',
      price: Number(price) || 5,
      estimatedArrival: Number(estimatedArrival) || 5,
      address: 'Nearby charging point',
      location: request.location,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString()
    };

    if (!db || mockMode) {
      // Update request to RESPONDING + lock to this host
      request.status = 'RESPONDING';
      request.acceptedBy = hostId;
      request.acceptanceExpiresAt = new Date(Date.now() + ACCEPTANCE_TTL_MS).toISOString();
      inMemoryRequests.set(requestId, request);

      // Save response
      const list = inMemoryResponses.get(requestId) || [];
      list.push(response);
      inMemoryResponses.set(requestId, list);
    } else {
      // Firestore transaction: atomically update request and create response
      await db.runTransaction(async (txn) => {
        const currentSnap = await txn.get(requestRef);
        if (!currentSnap.exists) {
          throw new Error('Request not found');
        }

        const current = currentSnap.data();
        const normalized = resetExpiredAcceptances({ ...current });

        // If a stale lock expired, clear it first so new hosts can accept.
        if (
          current.status !== normalized.status ||
          current.acceptedBy !== normalized.acceptedBy ||
          current.acceptanceExpiresAt !== normalized.acceptanceExpiresAt
        ) {
          txn.update(requestRef, {
            status: normalized.status,
            acceptedBy: normalized.acceptedBy || null,
            acceptanceExpiresAt: normalized.acceptanceExpiresAt || null
          });
        }

        if (isExpired(normalized.expiresAt)) {
          throw new Error('Request not found or expired');
        }

        if (normalized.status === 'RESPONDING' && normalized.acceptedBy && normalized.acceptedBy !== hostId) {
          throw new Error('Another host already accepted this request');
        }

        if (normalized.status !== 'OPEN' && normalized.status !== 'RESPONDING') {
          throw new Error('Request is no longer available');
        }

        // Lock request to this host
        txn.update(requestRef, {
          status: 'RESPONDING',
          acceptedBy: hostId,
          acceptanceExpiresAt: new Date(Date.now() + ACCEPTANCE_TTL_MS).toISOString()
        });

        // Create response
        txn.set(db.collection('responses').doc(response.id), response);
      });
    }

    // Keep compatibility with clients that render a live host list.
    emitToRequest(requestId, 'response_update', { action: 'added', response });

    // Emit to user and other hosts that this request is now taken
    emitToRequest(requestId, 'request_accepted', {
      requestId,
      hostId,
      acceptedAt: new Date().toISOString(),
      expiresInSeconds: 30,
      price: Number(price) || 5,
      estimatedArrival: Number(estimatedArrival) || 5
    });

    // Push: notify user that a host accepted (fire-and-forget)
    getUserDisplayName(hostId).then((hostName) => {
      sendPushNotification(
        request.userId,
        'Request accepted',
        `${hostName} accepted your request`,
        { requestId, deepLink: `/?role=user&tab=charge&requestId=${requestId}` }
      ).catch(() => {});
    }).catch(() => {});

    return res.json({ success: true, response });
  } catch (error) {
    if (error.message.includes('Another host already accepted')) {
      return res.status(409).json({ success: false, error: 'This request was already accepted by another host' });
    }
    return res.status(500).json({ success: false, error: 'Failed to send response: ' + error.message });
  }
}

function registerRoutes(app) {
  const router = express.Router();
  router.post('/request', requireAuth, createRequest);
  router.get('/requests/:id/responses', requireAuth, getRequestResponses);
  router.get('/requests/pending', requireAuth, listPendingRequests);
  router.post('/respond', requireAuth, respondToRequest);
  app.use('/api', router);
}

module.exports = { registerRoutes };
