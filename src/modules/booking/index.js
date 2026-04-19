const express = require('express');
const { db, mockMode } = require('../../lib/firestore');
const cache = require('../../lib/cache');
const logger = require('../../lib/logger');
const { emitToRequest, emitToUser, emitToHost } = require('../../realtime');

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function createBooking(req, res) {
  try {
    const { userId, hostId, requestId, price } = req.body || {};
    if (!userId || !hostId || !requestId) {
      return res.status(400).json({ success: false, error: 'userId, hostId and requestId are required' });
    }

    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    if (!db || mockMode) {
      const startPin = generatePin();
      const booking = {
        id: bookingId,
        userId,
        hostId,
        requestId,
        price: Number(price) || 5,
        status: 'CONFIRMED',
        startPin,
        createdAt: new Date().toISOString()
      };
      // Emit startPin only to user (not host), user shows it on their screen
      emitToUser(userId, 'booking_confirmed', { booking });
      emitToHost(hostId, 'booking_confirmed', { booking: { ...booking, startPin: undefined } });
      return res.json({ success: true, booking });
    }

    let booking = null;
    await db.runTransaction(async (txn) => {
      const requestRef = db.collection('requests').doc(requestId);
      const requestSnap = await txn.get(requestRef);
      if (!requestSnap.exists) throw new Error('Request not found');

      const requestData = requestSnap.data();
      const acceptanceExpired = requestData.acceptanceExpiresAt && new Date(requestData.acceptanceExpiresAt).getTime() <= Date.now();

      // Clear stale acceptance lock if it expired.
      if (requestData.status === 'RESPONDING' && acceptanceExpired) {
        txn.update(requestRef, {
          status: 'OPEN',
          acceptedBy: null,
          acceptanceExpiresAt: null
        });
        throw new Error('Accepted offer expired. Please wait for a fresh host acceptance.');
      }

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

      const startPin = generatePin();

      booking = {
        id: bookingId,
        userId,
        hostId,
        requestId,
        price: Number(price) || 5,
        status: 'CONFIRMED',
        startPin,
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

    // Emit startPin only to user (user shows the PIN on their screen to the host)
    emitToRequest(requestId, 'booking_confirmed', { booking: { ...booking, startPin: undefined } });
    emitToUser(userId, 'booking_confirmed', { booking });          // user sees startPin
    emitToHost(hostId, 'booking_confirmed', { booking: { ...booking, startPin: undefined } }); // host does NOT see pin

    // Return pin to caller (user-side client)
    return res.json({ success: true, booking });
  } catch (err) {
    logger.error('createBooking failed', { err: err.message });
    const status = (err.message?.includes('superseded') || err.message?.includes('expired')) ? 409 : 400;
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

async function getBookingHistory(req, res) {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });

    if (!db || mockMode) {
      return res.json({ success: true, bookings: [] });
    }

    const [asUser, asHost] = await Promise.all([
      db.collection('bookings')
        .where('userId', '==', userId)
        .where('status', '==', 'COMPLETED')
        .orderBy('createdAt', 'desc')
        .limit(30)
        .get(),
      db.collection('bookings')
        .where('hostId', '==', userId)
        .where('status', '==', 'COMPLETED')
        .orderBy('createdAt', 'desc')
        .limit(30)
        .get()
    ]);

    const seen = new Set();
    const bookings = [];
    for (const snap of [asUser, asHost]) {
      snap.docs.forEach(doc => {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          bookings.push({ id: doc.id, ...doc.data() });
        }
      });
    }
    bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ success: true, bookings: bookings.slice(0, 50) });
  } catch (err) {
    logger.error('getBookingHistory failed', { err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to load booking history' });
  }
}

async function getActiveBooking(req, res) {
  try {
    const { userId, role } = req.query || {};
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const normalizedRole = String(role || 'user').toLowerCase();
    const roleField = normalizedRole === 'host' ? 'hostId' : 'userId';

    if (!db || mockMode) {
      return res.json({ success: true, booking: null });
    }

    const snap = await db.collection('bookings')
      .where(roleField, '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    if (snap.empty) {
      return res.json({ success: true, booking: null });
    }

    const candidates = snap.docs.map((doc) => doc.data());
    const active = candidates.find((b) => {
      const status = String(b.status || '').toUpperCase();
      if (status === 'BOOKED' || status === 'CONFIRMED' || status === 'STARTED') return true;
      if (status === 'COMPLETED' && String(b.paymentStatus || 'PENDING').toUpperCase() !== 'CONFIRMED') return true;
      return false;
    }) || null;

    if (active) {
      await cache.set(`booking:${active.id}`, active, 60).catch(() => {});
    }

    return res.json({ success: true, booking: active });
  } catch (err) {
    logger.error('getActiveBooking failed', { err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to load active booking' });
  }
}

function registerRoutes(app) {
  const router = express.Router();
  router.post('/book', createBooking);
  router.get('/booking/:id', getBooking);
  router.get('/bookings/active', getActiveBooking);
  router.get('/bookings/history/:userId', getBookingHistory);
  app.use('/api', router);
}

module.exports = { registerRoutes };
