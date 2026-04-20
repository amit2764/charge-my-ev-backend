const { db, mockMode } = require('./firestore');
const logger = require('./logger');
const { emitToUser, emitToHost } = require('../realtime');

const STALE_PENDING_MINUTES = Number(process.env.PAYMENT_PENDING_STALE_MINUTES || 90);
const CRON_INTERVAL_MS = Number(process.env.PAYMENT_RECOVERY_INTERVAL_MS || 10 * 60 * 1000);

function parseTime(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return null;
}

function isStale(booking) {
  const now = Date.now();
  const marker = parseTime(booking.updatedAt) || parseTime(booking.endTime) || parseTime(booking.createdAt);
  if (!marker) return false;
  return now - marker.getTime() >= STALE_PENDING_MINUTES * 60 * 1000;
}

function resolvePaymentStatus(payment = {}) {
  const userConfirmed = !!payment.userConfirmed;
  const hostConfirmed = !!payment.hostConfirmed;
  if (userConfirmed && hostConfirmed) return 'CONFIRMED';
  if (userConfirmed) return 'USER_CONFIRMED';
  if (hostConfirmed) return 'HOST_CONFIRMED';
  return 'PENDING';
}

async function collectStalePendingBookings() {
  const statuses = ['PENDING', 'USER_CONFIRMED', 'HOST_CONFIRMED'];
  const all = [];

  for (const status of statuses) {
    const snap = await db.collection('bookings')
      .where('status', '==', 'COMPLETED')
      .where('paymentStatus', '==', status)
      .limit(200)
      .get();

    snap.forEach((doc) => {
      all.push({ id: doc.id, ...doc.data() });
    });
  }

  return all.filter(isStale);
}

async function resolveStalePendingPayments() {
  if (!db || mockMode) return;

  try {
    const stale = await collectStalePendingBookings();
    if (!stale.length) return;

    for (const booking of stale) {
      const payment = {
        method: booking.payment?.method || 'cash',
        userConfirmed: !!booking.payment?.userConfirmed,
        hostConfirmed: !!booking.payment?.hostConfirmed,
        userConfirmedAt: booking.payment?.userConfirmedAt || null,
        hostConfirmedAt: booking.payment?.hostConfirmedAt || null,
        confirmedAt: booking.payment?.confirmedAt || null,
        status: resolvePaymentStatus(booking.payment || {})
      };

      let nextStatus = booking.paymentStatus || payment.status;
      let resolution = booking.paymentResolution || null;

      if (payment.status === 'PENDING') {
        nextStatus = 'EXPIRED';
        resolution = 'AUTO_EXPIRED_NO_CONFIRMATION';
      } else if (payment.status === 'USER_CONFIRMED' || payment.status === 'HOST_CONFIRMED') {
        nextStatus = 'REQUIRES_SUPPORT';
        resolution = 'AUTO_ESCALATED_PARTIAL_CONFIRMATION';
      }

      if (['CONFIRMED', 'EXPIRED', 'REQUIRES_SUPPORT'].includes(String(booking.paymentStatus || '').toUpperCase())) {
        continue;
      }

      const now = new Date().toISOString();
      await db.collection('bookings').doc(booking.id).update({
        paymentStatus: nextStatus,
        payment: {
          ...payment,
          status: nextStatus
        },
        paymentResolution: resolution,
        paymentResolvedAt: now,
        updatedAt: now
      });

      emitToUser(booking.userId, 'payment_update', {
        bookingId: booking.id,
        paymentStatus: nextStatus,
        payment: {
          ...payment,
          status: nextStatus
        }
      });
      emitToHost(booking.hostId, 'payment_update', {
        bookingId: booking.id,
        paymentStatus: nextStatus,
        payment: {
          ...payment,
          status: nextStatus
        }
      });
    }

    logger.info('payment recovery cron resolved stale records', { count: stale.length });
  } catch (err) {
    logger.error('payment recovery cron failed', { err: err.message });
  }
}

function startPaymentRecoveryCron() {
  if (!db || mockMode) return;
  resolveStalePendingPayments();
  setInterval(resolveStalePendingPayments, CRON_INTERVAL_MS);
}

module.exports = {
  startPaymentRecoveryCron,
  resolveStalePendingPayments
};
