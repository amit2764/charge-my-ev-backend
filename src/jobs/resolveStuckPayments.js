const admin = require('firebase-admin');
const { db, mockMode } = require('../lib/firestore');
const logger = require('../lib/logger');
const { sendPushNotification } = require('../utils/notify');
const { stopOrphanedSessions } = require('./stopOrphanedSessions');

const STUCK_MS = 30 * 60 * 1000;
const ORPHAN_MS = 4 * 60 * 60 * 1000;

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.seconds === 'number') return (value.seconds * 1000) + Math.floor((value.nanoseconds || 0) / 1e6);
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getReferenceMs(booking) {
  return (
    toMillis(booking.updatedAt) ||
    toMillis(booking.endTime) ||
    toMillis(booking.startTime) ||
    toMillis(booking.createdAt)
  );
}

function computeResolution(booking, nowMs) {
  const uc = booking?.payment?.userConfirmed === true;
  const hc = booking?.payment?.hostConfirmed === true;
  const paymentStatus = String(booking?.payment?.status || booking?.paymentStatus || 'PENDING').toUpperCase();
  const status = String(booking?.status || '').toUpperCase();
  const referenceMs = getReferenceMs(booking);

  if (status !== 'STARTED' || !referenceMs) return null;
  const ageMs = nowMs - referenceMs;
  if (ageMs < STUCK_MS) return null;

  if (!uc && !hc && paymentStatus === 'PENDING' && ageMs >= ORPHAN_MS) {
    return {
      reason: 'orphaned_session',
      paymentStatus: 'REQUIRES_SUPPORT',
      bookingStatus: 'STARTED'
    };
  }

  if (uc && !hc) {
    return {
      reason: 'auto_host_absent',
      paymentStatus: 'CONFIRMED',
      bookingStatus: 'COMPLETED'
    };
  }

  if (!uc && hc) {
    return {
      reason: 'auto_user_absent',
      paymentStatus: 'REQUIRES_SUPPORT',
      bookingStatus: 'STARTED'
    };
  }

  if (!uc && !hc) {
    return {
      reason: 'auto_both_absent',
      paymentStatus: 'EXPIRED',
      bookingStatus: 'STARTED'
    };
  }

  return null;
}

async function resolveSingleBooking(bookingRef) {
  const nowMs = Date.now();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists) return null;

    const booking = snap.data() || {};
    if (booking?.meta?.autoResolvedAt) return null;

    const decision = computeResolution(booking, nowMs);
    if (!decision) return null;

    const nowTs = admin.firestore.FieldValue.serverTimestamp();
    const updates = {
      paymentStatus: decision.paymentStatus,
      'payment.status': decision.paymentStatus,
      status: decision.bookingStatus,
      'meta.autoResolution': decision.reason,
      'meta.autoResolvedAt': nowTs,
      updatedAt: nowTs
    };

    if (decision.bookingStatus === 'COMPLETED') {
      updates.completedAt = nowTs;
    }

    tx.update(bookingRef, updates);

    return {
      bookingId: snap.id,
      userId: booking.userId,
      hostId: booking.hostId,
      reason: decision.reason,
      paymentStatus: decision.paymentStatus,
      bookingStatus: decision.bookingStatus
    };
  });

  return result;
}

async function notifyAutoResolvedBooking(result) {
  if (!result) return;
  const title = 'Payment auto-resolved';
  const body = `Booking ${result.bookingId} was auto-resolved: ${result.reason}`;

  await Promise.all([
    sendPushNotification(result.userId, title, body, {
      bookingId: result.bookingId,
      notificationCategory: 'paymentAlerts',
      reason: result.reason,
      deepLink: `/?role=user&tab=charge&bookingId=${result.bookingId}`
    }).catch((error) => {
      logger.warn('resolveStuckPayments user notification failed', { bookingId: result.bookingId, userId: result.userId, error: error.message });
    }),
    sendPushNotification(result.hostId, title, body, {
      bookingId: result.bookingId,
      notificationCategory: 'paymentAlerts',
      reason: result.reason,
      deepLink: `/?role=host&tab=dashboard&bookingId=${result.bookingId}`
    }).catch((error) => {
      logger.warn('resolveStuckPayments host notification failed', { bookingId: result.bookingId, hostId: result.hostId, error: error.message });
    })
  ]);
}

async function resolveStuckPayments() {
  if (!db || mockMode) {
    logger.warn('resolveStuckPayments skipped: Firestore not initialized or mock mode');
    return 0;
  }

  try {
    const candidates = await db.collection('bookings')
      .where('status', '==', 'STARTED')
      .where('meta.autoResolvedAt', '==', null)
      .limit(300)
      .get();

    if (candidates.empty) {
      logger.info('resolveStuckPayments run complete', { resolvedCount: 0, scannedCount: 0 });
      return 0;
    }

    let resolvedCount = 0;
    for (const doc of candidates.docs) {
      const result = await resolveSingleBooking(doc.ref);
      if (!result) continue;
      resolvedCount += 1;
      await notifyAutoResolvedBooking(result);
    }

    logger.info('resolveStuckPayments run complete', {
      scannedCount: candidates.size,
      resolvedCount
    });

    // Keep orphaned-session handling on the same 10-minute cadence.
    await stopOrphanedSessions();

    return resolvedCount;
  } catch (error) {
    logger.error('resolveStuckPayments failed', { error: error.message, stack: error.stack });
    return 0;
  }
}

module.exports = { resolveStuckPayments };
