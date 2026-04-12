const express = require('express');
const { db, mockMode } = require('../../lib/firestore');
const cache = require('../../lib/cache');
const logger = require('../../lib/logger');

async function createBooking(req, res) {
  // stub create - in real impl write to Firestore and return booking
  const booking = { id: 'booking_stub_1', ...req.body };
  return res.json({ success: true, booking });
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
