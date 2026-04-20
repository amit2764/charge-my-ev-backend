const admin = require('firebase-admin');
const { db, mockMode } = require('../lib/firestore');
const logger = require('../lib/logger');
const { sendPushNotification } = require('../utils/notify');

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
    toMillis(booking.startTime) ||
    toMillis(booking.createdAt)
  );
}

function qualifiesAsOrphan(booking, nowMs) {
  if (String(booking?.status || '').toUpperCase() !== 'STARTED') return false;
  if (booking?.meta?.autoResolvedAt) return false;

  const paymentStatus = String(booking?.payment?.status || booking?.paymentStatus || 'PENDING').toUpperCase();
  const userConfirmed = booking?.payment?.userConfirmed === true;
  const hostConfirmed = booking?.payment?.hostConfirmed === true;
  if (paymentStatus !== 'PENDING' || userConfirmed || hostConfirmed) return false;

  const refMs = getReferenceMs(booking);
  if (!refMs) return false;
  return (nowMs - refMs) >= ORPHAN_MS;
}

async function resolveSingleOrphan(bookingRef) {
  const nowMs = Date.now();

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(bookingRef);
    if (!snap.exists) return null;

    const booking = snap.data() || {};
    if (!qualifiesAsOrphan(booking, nowMs)) return null;

    const nowTs = admin.firestore.FieldValue.serverTimestamp();
    const reason = 'orphaned_session_pending_4h';
    tx.set(bookingRef, {
      paymentStatus: 'REQUIRES_SUPPORT',
      'payment.status': 'REQUIRES_SUPPORT',
      'meta.autoResolution': reason,
      'meta.autoResolvedAt': nowTs,
      updatedAt: nowTs
    }, { merge: true });

    return {
      bookingId: snap.id,
      userId: booking.userId,
      hostId: booking.hostId,
      reason
    };
  });
}

async function notifyOrphanResolution(result) {
  if (!result) return;
  const title = 'Session marked for support';
  const body = `Booking ${result.bookingId} requires manual review.`;

  await Promise.all([
    sendPushNotification(result.userId, title, body, {
      bookingId: result.bookingId,
      reason: result.reason,
      notificationCategory: 'paymentAlerts',
      deepLink: `/?role=user&tab=charge&bookingId=${result.bookingId}`
    }).catch((error) => {
      logger.warn('stopOrphanedSessions user notification failed', { bookingId: result.bookingId, userId: result.userId, error: error.message });
    }),
    sendPushNotification(result.hostId, title, body, {
      bookingId: result.bookingId,
      reason: result.reason,
      notificationCategory: 'paymentAlerts',
      deepLink: `/?role=host&tab=dashboard&bookingId=${result.bookingId}`
    }).catch((error) => {
      logger.warn('stopOrphanedSessions host notification failed', { bookingId: result.bookingId, hostId: result.hostId, error: error.message });
    })
  ]);
}

async function stopOrphanedSessions() {
  if (!db || mockMode) {
    logger.warn('stopOrphanedSessions skipped: Firestore not initialized or mock mode');
    return 0;
  }

  try {
    const candidates = await db.collection('bookings')
      .where('status', '==', 'STARTED')
      .where('payment.status', '==', 'PENDING')
      .where('meta.autoResolvedAt', '==', null)
      .limit(300)
      .get();

    if (candidates.empty) {
      logger.info('stopOrphanedSessions run complete', { resolvedCount: 0, scannedCount: 0 });
      return 0;
    }

    let resolvedCount = 0;
    for (const doc of candidates.docs) {
      const result = await resolveSingleOrphan(doc.ref);
      if (!result) continue;
      resolvedCount += 1;
      await notifyOrphanResolution(result);
    }

    logger.info('stopOrphanedSessions run complete', {
      scannedCount: candidates.size,
      resolvedCount
    });
    return resolvedCount;
  } catch (error) {
    logger.error('stopOrphanedSessions failed', { error: error.message, stack: error.stack });
    return 0;
  }
}

module.exports = { stopOrphanedSessions };
