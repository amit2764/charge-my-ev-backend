const express = require('express');
const { emitToRequest } = require('../../realtime');

const requests = new Map();
const responsesByRequest = new Map();

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function createRequest(req, res) {
  try {
    const { userId, location, vehicleType } = req.body || {};
    if (!userId || !location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
      return res.status(400).json({ success: false, error: 'userId and valid location are required' });
    }

    const request = {
      id: uid('req'),
      userId,
      location,
      vehicleType: vehicleType || 'electric',
      status: 'OPEN',
      createdAt: new Date().toISOString()
    };
    requests.set(request.id, request);
    return res.json({ success: true, request });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to create request' });
  }
}

async function listPendingRequests(req, res) {
  try {
    const pending = Array.from(requests.values())
      .filter(r => r.status === 'OPEN')
      .map(r => ({
        ...r,
        distance: 1.2,
        rating: 4.9
      }))
      .slice(0, 20);
    return res.json({ success: true, requests: pending });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to load pending requests' });
  }
}

async function respondToRequest(req, res) {
  try {
    const { requestId, hostId, status, price, estimatedArrival } = req.body || {};
    if (!requestId || !hostId) {
      return res.status(400).json({ success: false, error: 'requestId and hostId are required' });
    }

    const request = requests.get(requestId);
    if (!request || request.status !== 'OPEN') {
      return res.status(404).json({ success: false, error: 'Request not found or closed' });
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
      createdAt: new Date().toISOString()
    };

    const list = responsesByRequest.get(requestId) || [];
    list.push(response);
    responsesByRequest.set(requestId, list);

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
