const express = require('express');
const { db, mockMode } = require('../../lib/firestore');
const cache = require('../../lib/cache');
const logger = require('../../lib/logger');
const { emitToUser, emitToHost } = require('../../realtime');
const { isHostOnline } = require('../../realtime');
const { updateLastSeenMiddleware } = require('../booking');
const { sendPushNotification, getUserDisplayName } = require('../../utils/notify');
const { applyPromoDiscount } = require('../moderation');
const { requireAuth } = require('../../middleware/auth');

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function redactPinsForHost(booking) {
  return {
    ...booking,
    startPin: undefined,
    stopPin: undefined
  };
}

function normalizePaymentOnCompletion(booking = {}) {
  const current = booking.payment || {};
  const userConfirmed = !!current.userConfirmed;
  const hostConfirmed = !!current.hostConfirmed;
  const isConfirmed = userConfirmed && hostConfirmed;
  return {
    method: current.method || 'cash',
    userConfirmed,
    hostConfirmed,
    status: isConfirmed ? 'CONFIRMED' : 'PENDING',
    confirmedAt: isConfirmed ? (current.confirmedAt || null) : null,
    userConfirmedAt: current.userConfirmedAt || null,
    hostConfirmedAt: current.hostConfirmedAt || null,
    autoResolved: !!current.autoResolved,
    autoResolvedAt: current.autoResolvedAt || null,
    autoResolution: current.autoResolution || null
  };
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
      const updated = { ...(booking || { id: bookingId }), status: 'STARTED', startTime, stopPin, updatedAt: new Date().toISOString() };
      await cache.set(`booking:${bookingId}`, updated, 3600).catch(() => {});
      emitToUser(updated.userId, 'session_started', { booking: updated });
      emitToHost(updated.hostId, 'session_started', { booking: redactPinsForHost(updated) });
      return res.json({ success: true, booking: redactPinsForHost(updated) });
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
      updatedAt: new Date().toISOString(),
      startPin: null,     // consume the PIN
      stopPin             // store stop PIN (only user will see this)
    });

    const updated = { ...booking, status: 'STARTED', startTime, stopPin, updatedAt: new Date().toISOString() };
    await cache.set(`booking:${bookingId}`, updated, 3600);

    // User gets the stopPin to show host later; host only gets the status change
    emitToUser(booking.userId, 'session_started', { booking: updated });
    emitToHost(booking.hostId, 'session_started', { booking: redactPinsForHost(updated) });

    // Push notifications (fire-and-forget)
    getUserDisplayName(booking.hostId).then((hostName) => {
      const deepLink = `/?role=user&tab=charge&bookingId=${bookingId}`;
      sendPushNotification(booking.userId, 'Charging started', `Session started at ${hostName}`, { bookingId, deepLink }).catch(() => {});
      sendPushNotification(booking.hostId, 'Charging started', `Session started with user ${String(booking.userId).slice(-4)}`, { bookingId, deepLink: `/?role=host&tab=dashboard&bookingId=${bookingId}` }).catch(() => {});
    }).catch(() => {});

    return res.json({ success: true, booking: redactPinsForHost(updated) });
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
      let finalAmount = ((durationMinutes / 60) * (booking?.price || 5)).toFixed(2);
      
      // Apply promo discount if code exists (mock mode)
      if (booking?.promoCode) {
        const value = 10; // Mock discount value
        finalAmount = Math.max(0, Number(finalAmount) - value).toFixed(2);
      }
      
      const payment = normalizePaymentOnCompletion(booking || {});
      const updated = {
        ...(booking || { id: bookingId }),
        status: payment.status === 'CONFIRMED' ? 'COMPLETED' : 'STARTED',
        endTime,
        updatedAt: new Date().toISOString(),
        durationMinutes: Number(durationMinutes.toFixed(2)),
        finalAmount: Number(finalAmount),
        payment,
        paymentStatus: payment.status,
        paymentMethod: payment.method
      };
      await cache.set(`booking:${bookingId}`, updated, 3600).catch(() => {});
      emitToUser(updated.userId, 'session_stopped', { booking: updated, finalAmount: updated.finalAmount });
      emitToHost(updated.hostId, 'session_stopped', { booking: redactPinsForHost(updated), finalAmount: updated.finalAmount });
      return res.json({ success: true, booking: redactPinsForHost(updated), finalAmount: updated.finalAmount, durationMinutes: updated.durationMinutes });
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
    let finalAmount = Number(((durationMinutes / 60) * booking.price).toFixed(2));
    
    // Apply promo discount if code exists
    if (booking.promoCode) {
      const bookingRef = db.collection('bookings').doc(bookingId);
      finalAmount = await applyPromoDiscount(bookingRef, booking.promoCode, finalAmount);
    }
    
    const payment = normalizePaymentOnCompletion(booking);

    await db.collection('bookings').doc(bookingId).update({
      status: payment.status === 'CONFIRMED' ? 'COMPLETED' : 'STARTED',
      endTime,
      updatedAt: new Date().toISOString(),
      durationMinutes: Number(durationMinutes.toFixed(2)),
      finalAmount,
      stopPin: null,   // consume the PIN
      payment,
      paymentStatus: payment.status,
      paymentMethod: payment.method,
      meta: {
        userLastSeenAt: booking.meta?.userLastSeenAt || null,
        hostLastSeenAt: booking.meta?.hostLastSeenAt || null,
        autoResolution: booking.meta?.autoResolution || null,
        autoResolvedAt: booking.meta?.autoResolvedAt || null,
        stuckReason: booking.meta?.stuckReason || null
      }
    });

    const updated = {
      ...booking,
      status: payment.status === 'CONFIRMED' ? 'COMPLETED' : 'STARTED',
      endTime,
      updatedAt: new Date().toISOString(),
      durationMinutes: Number(durationMinutes.toFixed(2)),
      finalAmount,
      stopPin: null,
      payment,
      paymentStatus: payment.status,
      paymentMethod: payment.method
    };
    await cache.set(`booking:${bookingId}`, updated, 3600);

    emitToUser(booking.userId, 'session_stopped', { booking: updated, finalAmount });
    emitToHost(booking.hostId, 'session_stopped', { booking: redactPinsForHost(updated), finalAmount });

    // Push notifications (fire-and-forget)
    sendPushNotification(booking.userId, 'Charging ended', `Confirm payment for your session.`, { bookingId, deepLink: `/?role=user&tab=charge&bookingId=${bookingId}` }).catch(() => {});
    sendPushNotification(booking.hostId, 'Charging ended', `Session stopped. Confirm payment received.`, { bookingId, deepLink: `/?role=host&tab=dashboard&bookingId=${bookingId}` }).catch(() => {});

    return res.json({ success: true, booking: redactPinsForHost(updated), finalAmount, durationMinutes: Number(durationMinutes.toFixed(2)) });
  } catch (err) {
    logger.error('stopSession failed', { err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to stop session: ' + err.message });
  }
}

async function emergencyStop(req, res) {
  try {
    const { bookingId, userId } = req.body || {};
    if (!bookingId || !userId) {
      return res.status(400).json({ success: false, error: 'bookingId and userId are required' });
    }

    const booking = await getBookingById(bookingId);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    if (booking.userId !== userId && booking.hostId !== userId) {
      return res.status(403).json({ success: false, error: 'Not authorized to stop this session' });
    }

    if (booking.status !== 'STARTED') {
      return res.status(400).json({ success: false, error: 'Session is not currently running' });
    }

    const endTime = new Date().toISOString();
    const durationMinutes = booking.startTime
      ? (new Date(endTime) - new Date(booking.startTime)) / 60000
      : 0;
    const modeMultiplier = booking.chargingMode === 'eco' ? 0.8 : booking.chargingMode === 'boost' ? 1.2 : 1.0;
    let finalAmount = Number(((durationMinutes / 60) * (booking.price || 5) * modeMultiplier).toFixed(2));
    
    // Apply promo discount if code exists
    if (booking.promoCode && db && !mockMode) {
      const bookingRef = db.collection('bookings').doc(bookingId);
      finalAmount = await applyPromoDiscount(bookingRef, booking.promoCode, finalAmount);
    }
    
    const payment = normalizePaymentOnCompletion(booking);

    const updated = {
      ...booking,
      status: payment.status === 'CONFIRMED' ? 'COMPLETED' : 'STARTED',
      endTime,
      updatedAt: new Date().toISOString(),
      durationMinutes: Number(durationMinutes.toFixed(2)),
      finalAmount,
      emergencyStopped: true,
      emergencyStoppedBy: userId,
      stopPin: null,
      payment,
      paymentStatus: payment.status,
      paymentMethod: payment.method
    };

    if (!db || mockMode) {
      await cache.set(`booking:${bookingId}`, updated, 3600).catch(() => {});
    } else {
      await db.collection('bookings').doc(bookingId).update({
        status: payment.status === 'CONFIRMED' ? 'COMPLETED' : 'STARTED',
        endTime,
        updatedAt: new Date().toISOString(),
        durationMinutes: updated.durationMinutes,
        finalAmount,
        emergencyStopped: true,
        emergencyStoppedBy: userId,
        stopPin: null,
        payment,
        paymentStatus: payment.status
      });
      await cache.set(`booking:${bookingId}`, updated, 3600).catch(() => {});
    }

    emitToUser(booking.userId, 'session_stopped', { booking: updated, finalAmount });
    emitToHost(booking.hostId, 'session_stopped', { booking: redactPinsForHost(updated), finalAmount });

    return res.json({ success: true, booking: redactPinsForHost(updated), finalAmount });
  } catch (err) {
    logger.error('emergencyStop failed', { err: err.message });
    return res.status(500).json({ success: false, error: 'Emergency stop failed: ' + err.message });
  }
}

async function changeMode(req, res) {
  try {
    const { bookingId, userId, mode } = req.body || {};
    if (!bookingId || !userId || !mode) {
      return res.status(400).json({ success: false, error: 'bookingId, userId, and mode are required' });
    }

    const validModes = ['eco', 'normal', 'boost'];
    if (!validModes.includes(mode)) {
      return res.status(400).json({ success: false, error: 'Mode must be eco, normal, or boost' });
    }

    const booking = await getBookingById(bookingId);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    if (booking.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Only the charging user can change mode' });
    }

    if (booking.status !== 'STARTED') {
      return res.status(400).json({ success: false, error: 'Session must be running to change mode' });
    }

    const updated = { ...booking, chargingMode: mode };
    if (!db || mockMode) {
      await cache.set(`booking:${bookingId}`, updated, 3600).catch(() => {});
    } else {
      await db.collection('bookings').doc(bookingId).update({ chargingMode: mode });
      await cache.set(`booking:${bookingId}`, updated, 3600).catch(() => {});
    }

    emitToUser(booking.userId, 'mode_changed', { bookingId, mode });
    emitToHost(booking.hostId, 'mode_changed', { bookingId, mode });

    return res.json({ success: true, mode, booking: updated });
  } catch (err) {
    logger.error('changeMode failed', { err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to change charging mode' });
  }
}

async function getHostPresence(req, res) {
  try {
    const { bookingId } = req.params;
    if (!bookingId) {
      return res.status(400).json({ success: false, error: 'bookingId is required' });
    }

    const booking = await getBookingById(bookingId);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const hostOnline = !!(booking.hostId && isHostOnline(booking.hostId));
    return res.json({
      success: true,
      bookingId,
      hostId: booking.hostId,
      hostOnline,
      status: booking.status,
      canEmergencyStop: booking.status === 'STARTED'
    });
  } catch (err) {
    logger.error('getHostPresence failed', { err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to get host presence' });
  }
}

function registerRoutes(app) {
  const router = express.Router();
  router.post('/start', requireAuth, updateLastSeenMiddleware, startSession);
  router.post('/stop', requireAuth, updateLastSeenMiddleware, stopSession);
  router.post('/session/emergency-stop', requireAuth, updateLastSeenMiddleware, emergencyStop);
  router.post('/session/mode', requireAuth, updateLastSeenMiddleware, changeMode);
  router.get('/session/:bookingId/presence', requireAuth, updateLastSeenMiddleware, getHostPresence);
  app.use('/api', router);
}

module.exports = { registerRoutes };
