const express = require('express');
const { db, mockMode } = require('../../lib/firestore');
const { emitToRequest, emitRequestToNearbyHosts, isHostOnline, getHostMeta } = require('../../realtime');
const { haversineDistance } = require('../../lib/geohash');

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
    const { userId, location, vehicleType } = req.body || {};
    if (!userId || !location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return res.status(400).json({ success: false, error: 'userId and valid location are required' });
    }

    const id = uid('req');
    const request = {
      id,
      userId,
      location,
      vehicleType: vehicleType || 'electric',
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

async function respondToRequest(req, res) {
  try {
    const { requestId, hostId, status, price, estimatedArrival, hostLocation } = req.body || {};
    if (!requestId || !hostId) {
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
        const current = currentSnap.data();
        if (current.status === 'RESPONDING' && current.acceptedBy && current.acceptedBy !== hostId) {
          throw new Error('Another host already accepted this request');
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

    // Emit to user and other hosts that this request is now taken
    emitToRequest(requestId, 'request_accepted', {
      requestId,
      hostId,
      acceptedAt: new Date().toISOString(),
      expiresInSeconds: 30,
      price: Number(price) || 5,
      estimatedArrival: Number(estimatedArrival) || 5
    });

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
  router.post('/request', createRequest);
  router.get('/requests/pending', listPendingRequests);
  router.post('/respond', respondToRequest);
  app.use('/api', router);
}

module.exports = { registerRoutes };
