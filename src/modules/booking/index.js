const express = require('express');
const { db, mockMode } = require('../../lib/firestore');
const cache = require('../../lib/cache');
const logger = require('../../lib/logger');
const { emitToRequest, emitToUser, emitToHost } = require('../../realtime');

async function createBooking(req, res) {
  try {
    const { userId, hostId, requestId, price } = req.body || {};
    if (!userId || !hostId || !requestId) {
      return res.status(400).json({ success: false, error: 'userId, hostId and requestId are required' });
    }

    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (!db || mockMode) {
      const booking = {
        id: bookingId,
        userId,
        hostId,
        requestId,
        price: Number(price) || 5,
        status: 'CONFIRMED',
        createdAt: new Date().toISOString()
      };
      return res.json({ success: true, booking });
    }

    let booking = null;
    await db.runTransaction(async (txn) => {
      const requestRef = db.collection('requests').doc(requestId);
      const requestSnap = await txn.get(requestRef);
      if (!requestSnap.exists) throw new Error('Request not found');

      const requestData = requestSnap.data();

      // ============ KEY LOGIC: Only the accepted host can confirm booking (like Uber) ============
      if (requestData.status === 'RESPONDING' && requestData.acceptedBy && requestData.acceptedBy !== hostId) {
        throw new Error('This offer has been superseded by another host. Please try another request.');
      }

      // Allow OPEN status for backward compatibility, but RESPONDING requires acceptedBy match
      if (requestData.status !== 'OPEN' && requestData.status !== 'RESPONDING') {
        throw new Error('Request is no longer available for booking');
      }

      const responseQuery = await txn.get(
        db.collection('responses')
          .where('requestId', '==', requestId)
          .where('hostId', '==', hostId)
          .where('status', '==', 'ACCEPTED')
          .limit(1)
      );
      if (responseQuery.empty) throw new Error('Selected host has no active offer for this request');

      booking = {
        id: bookingId,
        userId,
        hostId,
        requestId,
        price: Number(price) || 5,
        status: 'CONFIRMED',
        createdAt: new Date().toISOString()
      };

      const bookingRef = db.collection('bookings').doc(bookingId);
      txn.set(bookingRef, booking);
      txn.update(requestRef, {
        status: 'BOOKED',
        bookedAt: new Date().toISOString(),
        bookingId,
        selectedHostId: hostId
      });
    });

    await cache.set(`booking:${booking.id}`, booking, 60);

    const payload = { booking };
    emitToRequest(requestId, 'booking_confirmed', payload);
    emitToUser(userId, 'booking_confirmed', payload);
    emitToHost(hostId, 'booking_confirmed', payload);

    return res.json({ success: true, booking });
  } catch (err) {
    logger.error('createBooking failed', { err: err.message });
    const status = err.message?.includes('superseded') ? 409 : 400;
    return res.status(status).json({ success: false, error: err.message || 'Booking failed' });
  }
}

async function getBooking(req, res) {
  try {
    const bookingId = req.params.id;
    const key = `booking:${bookingId}`;
    const cached = await cache.get(key);
    if (cached) return res.json({ success: true, booking: cached });

    if (!db || mockMode) {
      const mock = { id: bookingId, status: 'CONFIRMED' };
      await cache.set(key, mock, 60);
      return res.json({ success: true, booking: mock });
    }

    const snap = await db.collection('bookings').doc(bookingId).get();
    if (!snap.exists) return res.status(404).json({ success: false });
    const booking = snap.data();
    await cache.set(key, booking, 60);
    return res.json({ success: true, booking });
  } catch (err) {
    logger.error('getBooking failed', { err: err.message });
    return res.status(500).json({ success: false });
  }
}

function registerRoutes(app) {
  const router = express.Router();
  router.post('/book', createBooking);
  router.get('/booking/:id', getBooking);
  app.use('/api', router);
}

module.exports = { registerRoutes };
