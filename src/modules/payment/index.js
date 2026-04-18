const express = require('express');
const { db, mockMode } = require('../../lib/firestore');
const cache = require('../../lib/cache');
const logger = require('../../lib/logger');
const { emitToUser, emitToHost } = require('../../realtime');

async function getBooking(bookingId) {
  const cached = await cache.get(`booking:${bookingId}`).catch(() => null);
  if (cached) return cached;
  if (!db || mockMode) return null;

  const snap = await db.collection('bookings').doc(bookingId).get();
  if (!snap.exists) return null;
  return snap.data();
}

function normalizePaymentState(booking = {}) {
  const current = booking.payment || {};
  return {
    method: current.method || 'cash',
    userConfirmed: !!current.userConfirmed,
    hostConfirmed: !!current.hostConfirmed,
    status: current.status || 'PENDING',
    confirmedAt: current.confirmedAt || null,
    userConfirmedAt: current.userConfirmedAt || null,
    hostConfirmedAt: current.hostConfirmedAt || null
  };
}

async function createPaymentOrder(req, res) {
  res.json({ success: true, message: 'Create payment order (stub)' });
}

async function confirmPayment(req, res) {
  try {
    const { bookingId, confirmerId, role, confirmed } = req.body || {};
    if (!bookingId || !confirmerId || !role) {
      return res.status(400).json({ success: false, error: 'bookingId, confirmerId and role are required' });
    }

    const normalizedRole = String(role).toLowerCase();
    if (!['user', 'host'].includes(normalizedRole)) {
      return res.status(400).json({ success: false, error: 'role must be user or host' });
    }

    if (confirmed === false) {
      return res.status(400).json({ success: false, error: 'Only positive confirmation is supported currently' });
    }

    const now = new Date().toISOString();

    if (!db || mockMode) {
      const existing = (await getBooking(bookingId)) || { id: bookingId, status: 'COMPLETED' };
      const payment = normalizePaymentState(existing);
      if (normalizedRole === 'user') {
        payment.userConfirmed = true;
        payment.userConfirmedAt = now;
      } else {
        payment.hostConfirmed = true;
        payment.hostConfirmedAt = now;
      }
      if (payment.userConfirmed && payment.hostConfirmed) {
        payment.status = 'CONFIRMED';
        payment.confirmedAt = now;
      }

      const booking = {
        ...existing,
        payment,
        paymentStatus: payment.status,
        paymentMethod: payment.method
      };

      await cache.set(`booking:${bookingId}`, booking, 3600).catch(() => {});
      emitToUser(booking.userId, 'payment_update', { bookingId, paymentStatus: payment.status, payment });
      emitToHost(booking.hostId, 'payment_update', { bookingId, paymentStatus: payment.status, payment });

      return res.json({ success: true, booking, payment });
    }

    let updatedBooking = null;
    await db.runTransaction(async (txn) => {
      const bookingRef = db.collection('bookings').doc(bookingId);
      const snap = await txn.get(bookingRef);
      if (!snap.exists) throw new Error('Booking not found');

      const booking = snap.data();
      const payment = normalizePaymentState(booking);

      if (booking.status !== 'COMPLETED') {
        throw new Error('Payment can only be confirmed after session is completed');
      }

      if (normalizedRole === 'user') {
        if (booking.userId !== confirmerId) throw new Error('Only booking user can confirm as user');
        payment.userConfirmed = true;
        payment.userConfirmedAt = now;
      } else {
        if (booking.hostId !== confirmerId) throw new Error('Only booking host can confirm as host');
        payment.hostConfirmed = true;
        payment.hostConfirmedAt = now;
      }

      if (payment.userConfirmed && payment.hostConfirmed) {
        payment.status = 'CONFIRMED';
        payment.confirmedAt = now;
      } else {
        payment.status = 'PENDING';
      }

      const patch = {
        payment,
        paymentStatus: payment.status,
        paymentMethod: payment.method,
        updatedAt: now
      };

      txn.update(bookingRef, patch);
      updatedBooking = { ...booking, ...patch };
    });

    await cache.set(`booking:${bookingId}`, updatedBooking, 3600).catch(() => {});

    emitToUser(updatedBooking.userId, 'payment_update', {
      bookingId,
      paymentStatus: updatedBooking.paymentStatus,
      payment: updatedBooking.payment
    });
    emitToHost(updatedBooking.hostId, 'payment_update', {
      bookingId,
      paymentStatus: updatedBooking.paymentStatus,
      payment: updatedBooking.payment
    });

    return res.json({ success: true, booking: updatedBooking, payment: updatedBooking.payment });
  } catch (err) {
    logger.error('confirmPayment failed', { err: err.message });
    const status = err.message === 'Booking not found' ? 404 : 400;
    return res.status(status).json({ success: false, error: err.message || 'Payment confirmation failed' });
  }
}

async function getPaymentStatus(req, res) {
  try {
    const bookingId = req.params.bookingId;
    if (!bookingId) return res.status(400).json({ success: false, error: 'bookingId is required' });

    const booking = await getBooking(bookingId);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const payment = normalizePaymentState(booking);
    return res.json({
      success: true,
      bookingId,
      paymentStatus: booking.paymentStatus || payment.status,
      payment
    });
  } catch (err) {
    logger.error('getPaymentStatus failed', { err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to load payment status' });
  }
}

function registerRoutes(app) {
  const router = express.Router();
  router.post('/payments/create-order', createPaymentOrder);
  router.post('/payment/confirm', confirmPayment);
  router.get('/payment/:bookingId/status', getPaymentStatus);
  app.use('/api', router);
}

module.exports = { registerRoutes };
