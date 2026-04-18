const express = require('express');
const { db, mockMode } = require('../../lib/firestore');
const cache = require('../../lib/cache');
const logger = require('../../lib/logger');
const { emitToUser, emitToHost } = require('../../realtime');

// In-memory bookings store for mockMode (mirrors booking module's store)
// When a booking is created in mockMode it is only in-memory there, so we
// fetch from cache or allow start even without a PIN (dev convenience).
const MOCK_BOOKINGS = new Map();

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function getBookingById(bookingId) {
  // Try cache first
  const cached = await cache.get(`booking:${bookingId}`).catch(() => null);
  if (cached) return cached;

  if (!db || mockMode) return null;

  const snap = await db.collection('bookings').doc(bookingId).get();
  return snap.exists ? snap.data() : null;
}

async function startSession(req, res) {
  try {
    const { bookingId, otp } = req.body || {};
    if (!bookingId || !otp) {
      return res.status(400).json({ success: false, error: 'bookingId and otp (startPin) are required' });
    }

    const booking = await getBookingById(bookingId);

    if (!db || mockMode) {
      // Dev mode: accept any 4-digit PIN — just update status
      const startTime = new Date().toISOString();
      const stopPin = generatePin();
      const updated = { ...(booking || { id: bookingId }), status: 'STARTED', startTime, stopPin };
      await cache.set(`booking:${bookingId}`, updated, 3600).catch(() => {});
      emitToUser(updated.userId, 'session_started', { booking: updated });
      emitToHost(updated.hostId, 'session_started', { booking: { ...updated, stopPin: undefined } });
      return res.json({ success: true, booking: updated });
    }

    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    if (booking.status !== 'CONFIRMED') {
      return res.status(400).json({ success: false, error: `Cannot start session. Current status: ${booking.status}` });
    }

    if (!booking.startPin || booking.startPin !== String(otp)) {
      return res.status(400).json({ success: false, error: 'Invalid start PIN. Ask the user to show their PIN.' });
    }

    const startTime = new Date().toISOString();
    const stopPin = generatePin();

    await db.collection('bookings').doc(bookingId).update({
      status: 'STARTED',
      startTime,
      startPin: null,     // consume the PIN
      stopPin             // store stop PIN (only user will see this)
    });

    const updated = { ...booking, status: 'STARTED', startTime, stopPin };
    await cache.set(`booking:${bookingId}`, updated, 3600);

    // User gets the stopPin to show host later; host only gets the status change
    emitToUser(booking.userId, 'session_started', { booking: updated });
    emitToHost(booking.hostId, 'session_started', { booking: { ...updated, stopPin: undefined } });

    return res.json({ success: true, booking: updated });
  } catch (err) {
    logger.error('startSession failed', { err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to start session: ' + err.message });
  }
}

async function stopSession(req, res) {
  try {
    const { bookingId, otp } = req.body || {};
    if (!bookingId || !otp) {
      return res.status(400).json({ success: false, error: 'bookingId and otp (stopPin) are required' });
    }

    const booking = await getBookingById(bookingId);

    if (!db || mockMode) {
      const endTime = new Date().toISOString();
      const durationMinutes = booking?.startTime
        ? (new Date(endTime) - new Date(booking.startTime)) / 60000
        : 0;
      const finalAmount = ((durationMinutes / 60) * (booking?.price || 5)).toFixed(2);
      const updated = { ...(booking || { id: bookingId }), status: 'COMPLETED', endTime, durationMinutes: Number(durationMinutes.toFixed(2)), finalAmount: Number(finalAmount) };
      await cache.set(`booking:${bookingId}`, updated, 3600).catch(() => {});
      emitToUser(updated.userId, 'session_stopped', { booking: updated, finalAmount: updated.finalAmount });
      emitToHost(updated.hostId, 'session_stopped', { booking: updated, finalAmount: updated.finalAmount });
      return res.json({ success: true, booking: updated, finalAmount: updated.finalAmount, durationMinutes: updated.durationMinutes });
    }

    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    if (booking.status !== 'STARTED') {
      return res.status(400).json({ success: false, error: `Cannot stop session. Current status: ${booking.status}` });
    }

    if (!booking.stopPin || booking.stopPin !== String(otp)) {
      return res.status(400).json({ success: false, error: 'Invalid stop PIN. Ask the user to show their Stop PIN.' });
    }

    const endTime = new Date().toISOString();
    const durationMinutes = (new Date(endTime) - new Date(booking.startTime)) / 60000;
    const finalAmount = Number(((durationMinutes / 60) * booking.price).toFixed(2));

    await db.collection('bookings').doc(bookingId).update({
      status: 'COMPLETED',
      endTime,
      durationMinutes: Number(durationMinutes.toFixed(2)),
      finalAmount,
      stopPin: null   // consume the PIN
    });

    const updated = { ...booking, status: 'COMPLETED', endTime, durationMinutes: Number(durationMinutes.toFixed(2)), finalAmount, stopPin: null };
    await cache.set(`booking:${bookingId}`, updated, 3600);

    emitToUser(booking.userId, 'session_stopped', { booking: updated, finalAmount });
    emitToHost(booking.hostId, 'session_stopped', { booking: updated, finalAmount });

    return res.json({ success: true, booking: updated, finalAmount, durationMinutes: Number(durationMinutes.toFixed(2)) });
  } catch (err) {
    logger.error('stopSession failed', { err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to stop session: ' + err.message });
  }
}

function registerRoutes(app) {
  const router = express.Router();
  router.post('/start', startSession);
  router.post('/stop', stopSession);
  app.use('/api', router);
}

module.exports = { registerRoutes };
