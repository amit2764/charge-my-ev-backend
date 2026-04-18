const express = require('express');
const { db, mockMode } = require('../../lib/firestore');
const { emitToRequest, emitToHostsOnline, isHostOnline } = require('../../realtime');

const inMemoryRequests = new Map();
const inMemoryResponses = new Map();
const REQUEST_TTL_MS = 5 * 60 * 1000;

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isExpired(expiryIso) {
  return !expiryIso || new Date(expiryIso).getTime() <= Date.now();
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
      inMemoryRequests.set(id, request);
    } else {
      await db.collection('requests').doc(id).set(request);
    }

    emitToHostsOnline('new_request', { request });
    return res.json({ success: true, request });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to create request' });
  }
}

async function listPendingRequests(req, res) {
  try {
    let pending = [];

    if (!db || mockMode) {
      pending = Array.from(inMemoryRequests.values());
    } else {
      const snap = await db.collection('requests').where('status', '==', 'OPEN').limit(50).get();
      pending = snap.docs.map(doc => doc.data());
    }

    pending = pending
      .filter(r => !isExpired(r.expiresAt))
      .map(r => ({ ...r, distance: 1.2, rating: 4.9 }))
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
    if (!db || mockMode) {
      request = inMemoryRequests.get(requestId);
    } else {
      const snap = await db.collection('requests').doc(requestId).get();
      request = snap.exists ? snap.data() : null;
    }

    if (!request || request.status !== 'OPEN' || isExpired(request.expiresAt)) {
      return res.status(404).json({ success: false, error: 'Request not found or closed' });
    }

    if (hostLocation && request.location) {
      const latDiff = Math.abs(Number(hostLocation.lat) - Number(request.location.lat));
      const lngDiff = Math.abs(Number(hostLocation.lng) - Number(request.location.lng));
      if (latDiff > 0.4 || lngDiff > 0.4) {
        return res.status(400).json({ success: false, error: 'Host is too far from this request' });
      }
    }

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
      const list = inMemoryResponses.get(requestId) || [];
      list.push(response);
      inMemoryResponses.set(requestId, list);
    } else {
      await db.collection('responses').doc(response.id).set(response);
    }

    emitToRequest(requestId, 'response_update', {
      action: 'added',
      response
    });

    return res.json({ success: true, response });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to send response' });
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
