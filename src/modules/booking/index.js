const express = require('express');
const { admin, db, mockMode } = require('../../lib/firestore');
const cache = require('../../lib/cache');
const logger = require('../../lib/logger');
const { emitToRequest, emitToUser, emitToHost } = require('../../realtime');
const { sendPushNotification, getUserDisplayName } = require('../../utils/notify');
const { requireAuth } = require('../../middleware/auth');

/**
 * Middleware to update lastSeen timestamp on every booking API call
 * Tracks when user/host last interacted with the booking
 */
async function updateLastSeenMiddleware(req, res, next) {
  try {
    // Extract from body or query
    const userId = req.body?.userId || req.query?.userId;
    const role = req.body?.role || req.query?.role;
    const bookingId = req.body?.bookingId || req.params?.id;

    if (bookingId && userId && db && !mockMode) {
      const field = String(role || '').toLowerCase() === 'host' ? 'meta.hostLastSeenAt' : 'meta.userLastSeenAt';
      
      // Non-blocking update, don't wait or fail the request
      db.collection('bookings').doc(bookingId).update({
        [field]: admin.firestore.FieldValue.serverTimestamp(),
      }).catch((err) => {
        logger.debug('updateLastSeen failed', { bookingId, error: err.message });
      });
    }
  } catch (err) {
    logger.debug('updateLastSeenMiddleware error', { error: err.message });
  }
  
  next();
}

function generatePin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function createBooking(req, res) {
  try {
    const { hostId, requestId, price } = req.body || {};
    const userId = req.user.uid;
    if (!hostId || !requestId) {
      return res.status(400).json({ success: false, error: 'hostId and requestId are required' });
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
        promoCode: null,
        status: 'CONFIRMED',
        startPin,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        payment: {
          status: 'PENDING',
          userConfirmed: false,
          hostConfirmed: false,
          userConfirmedAt: null,
          hostConfirmedAt: null,
          autoResolved: false,
          autoResolvedAt: null,
          autoResolution: null
        },
        meta: {
          userLastSeenAt: null,
          hostLastSeenAt: null,
          autoResolution: null,
          autoResolvedAt: null,
          stuckReason: null
        }
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
        promoCode: requestData.promoCode || null,
        status: 'CONFIRMED',
        startPin,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        payment: {
          status: 'PENDING',
          userConfirmed: false,
          hostConfirmed: false,
          userConfirmedAt: null,
          hostConfirmedAt: null,
          autoResolved: false,
          autoResolvedAt: null,
          autoResolution: null
        },
        meta: {
          userLastSeenAt: null,
          hostLastSeenAt: null,
          autoResolution: null,
          autoResolvedAt: null,
          stuckReason: null
        }
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
    // Ensure the caller can only fetch their own history
    if (userId !== req.user.uid) return res.status(403).json({ success: false, error: 'Forbidden' });

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

function toIsoString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return null;
}

function toMinutes(startTime, endTime) {
  const start = new Date(startTime || 0).getTime();
  const end = new Date(endTime || 0).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.max(1, Math.round((end - start) / 60000));
}

async function getBookingHistoryPaginated(req, res) {
  try {
    const userId = req.user.uid;
    const role = String(req.query?.role || 'user').toLowerCase();
    const cursor = String(req.query?.cursor || '').trim();
    const limitRaw = Number(req.query?.limit || 20);
    const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20));

    if (!['user', 'host'].includes(role)) {
      return res.status(400).json({ success: false, error: 'role must be user or host' });
    }

    if (!db || mockMode) {
      return res.json({ success: true, items: [], nextCursor: null, hasMore: false });
    }

    const roleField = role === 'host' ? 'hostId' : 'userId';
    let query = db.collection('bookings')
      .where(roleField, '==', userId)
      .where('status', '==', 'COMPLETED')
      .orderBy('createdAt', 'desc')
      .limit(limit + 1);

    if (cursor) {
      query = query.startAfter(cursor);
    }

    const snap = await query.get();
    const docs = snap.docs.slice(0, limit);

    const items = await Promise.all(docs.map(async (doc) => {
      const booking = doc.data() || {};
      const bookingId = doc.id;
      const otherPartyId = role === 'host' ? booking.userId : booking.hostId;

      let otherPartyName = 'Unknown';
      let otherPartyRating = null;
      if (otherPartyId) {
        try {
          const userSnap = await db.collection('users').doc(otherPartyId).get();
          if (userSnap.exists) {
            const userData = userSnap.data() || {};
            otherPartyName = userData.name || userData.displayName || userData.fullName || 'Unknown';
            otherPartyRating = typeof userData.rating === 'number' ? userData.rating : null;
          }
        } catch {
          // Best-effort profile enrichment.
        }
      }

      let myRating = null;
      try {
        const myRatingSnap = await db.collection('ratings').doc(`${bookingId}_${userId}`).get();
        if (myRatingSnap.exists) {
          const ratingData = myRatingSnap.data() || {};
          myRating = ratingData.stars === null || ratingData.stars === undefined
            ? null
            : Number(ratingData.stars);
        }
      } catch {
        // Best-effort; leave null on lookup failure.
      }

      const createdAtIso = toIsoString(booking.createdAt);
      const completedAtIso = toIsoString(booking.completedAt);
      const date = completedAtIso || createdAtIso;

      const kwh = Number(booking.energyKwh ?? booking.kwh ?? booking.chargedKwh ?? 0) || 0;
      const duration = Number(booking.durationMinutes ?? booking.duration ?? 0) || toMinutes(booking.startTime, booking.endTime);

      return {
        id: bookingId,
        bookingId,
        date,
        otherPartyName,
        otherPartyRating,
        kwh,
        duration,
        finalAmount: Number(booking.finalAmount ?? booking.price ?? 0) || 0,
        paymentStatus: String(booking.paymentStatus || booking.payment?.status || 'PENDING').toUpperCase(),
        paymentMethod: booking.payment?.method || 'cash',
        myRating,
        role,
        startTime: toIsoString(booking.startTime),
        endTime: toIsoString(booking.endTime),
        chargerLocation: booking.chargerLocation || booking.location || null,
        hostId: booking.hostId || null,
        userId: booking.userId || null,
        chatLink: role === 'host'
          ? `/?role=host&tab=dashboard&bookingId=${bookingId}`
          : `/?role=user&tab=charge&bookingId=${bookingId}`
      };
    }));

    const hasMore = snap.docs.length > limit;
    const nextCursor = hasMore && docs.length > 0
      ? String(docs[docs.length - 1].data()?.createdAt || '')
      : null;

    return res.json({ success: true, items, nextCursor, hasMore });
  } catch (err) {
    logger.error('getBookingHistoryPaginated failed', { err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to load booking history' });
  }
}

async function getActiveBooking(req, res) {
  try {
    const { role } = req.query || {};
    const userId = req.user.uid;

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

    const candidates = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const confirmedTtlMinutes = Number(process.env.CONFIRMED_BOOKING_TTL_MINUTES || 30);
    const confirmedTtlMs = Number.isFinite(confirmedTtlMinutes) && confirmedTtlMinutes > 0
      ? confirmedTtlMinutes * 60 * 1000
      : 30 * 60 * 1000;
    const nowMs = Date.now();

    const isFreshPreStartBooking = (booking) => {
      const status = String(booking?.status || '').toUpperCase();
      if (status !== 'CONFIRMED') return true;

      const createdAtRaw = booking?.createdAt;
      if (!createdAtRaw) return false;

      const createdAtMs = new Date(createdAtRaw).getTime();
      if (!Number.isFinite(createdAtMs)) return false;

      return nowMs - createdAtMs <= confirmedTtlMs;
    };

    const active = candidates.find((b) => {
      const status = String(b.status || '').toUpperCase();
      const paymentStatus = String(b.paymentStatus || b.payment?.status || 'PENDING').toUpperCase();
      if (!isFreshPreStartBooking(b)) return false;
      if (status === 'BOOKED' || status === 'CONFIRMED' || status === 'STARTED') return true;
      if (status === 'COMPLETED' && ['PENDING', 'USER_CONFIRMED', 'HOST_CONFIRMED'].includes(paymentStatus)) return true;
      return false;
    }) || null;

    if (active?.id) {
      await cache.set(`booking:${active.id}`, active, 60).catch(() => {});
    }

    return res.json({ success: true, booking: active });
  } catch (err) {
    logger.error('getActiveBooking failed', { err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to load active booking' });
  }
}

async function confirmBookingPayment(req, res) {
  try {
    const bookingId = req.params.id;
    const role = String(req.body?.role || '').toLowerCase();

    if (!bookingId) {
      return res.status(400).json({ error: 'booking id is required' });
    }

    if (!['user', 'host'].includes(role)) {
      return res.status(400).json({ error: 'role must be user or host' });
    }

    if (!db || mockMode) {
      return res.json({ ok: true, booking: { id: bookingId } });
    }

    const ref = db.collection('bookings').doc(bookingId);
    let previousBooking = null;
    let updatedBooking = null;

    await db.runTransaction(async (txn) => {
      const snap = await txn.get(ref);
      if (!snap.exists) {
        throw new Error('BOOKING_NOT_FOUND');
      }

      const data = snap.data() || {};
      previousBooking = data;

      const paymentStatus = String(data?.payment?.status || data?.paymentStatus || 'PENDING').toUpperCase();
      const canConfirmPayment = (
        data.status === 'STARTED' ||
        (data.status === 'COMPLETED' && ['PENDING', 'USER_CONFIRMED', 'HOST_CONFIRMED'].includes(paymentStatus))
      );

      if (!canConfirmPayment) {
        throw new Error('NO_ACTIVE_SESSION');
      }

      const nowIso = new Date().toISOString();
      const payment = {
        ...(data.payment || {}),
        userConfirmed: !!data.payment?.userConfirmed,
        hostConfirmed: !!data.payment?.hostConfirmed,
        status: String(data.payment?.status || data.paymentStatus || 'PENDING').toUpperCase(),
        userConfirmedAt: data.payment?.userConfirmedAt || null,
        hostConfirmedAt: data.payment?.hostConfirmedAt || null
      };

      if (role === 'user' && payment.userConfirmed) {
        throw new Error('ALREADY_CONFIRMED');
      }
      if (role === 'host' && payment.hostConfirmed) {
        throw new Error('ALREADY_CONFIRMED');
      }

      if (role === 'user') {
        payment.userConfirmed = true;
        payment.userConfirmedAt = payment.userConfirmedAt || nowIso;
      } else {
        payment.hostConfirmed = true;
        payment.hostConfirmedAt = payment.hostConfirmedAt || nowIso;
      }

      if (payment.userConfirmed && payment.hostConfirmed) {
        payment.status = 'CONFIRMED';
      } else if (payment.userConfirmed) {
        payment.status = 'USER_CONFIRMED';
      } else if (payment.hostConfirmed) {
        payment.status = 'HOST_CONFIRMED';
      } else {
        payment.status = 'PENDING';
      }

      const update = {
        payment,
        paymentStatus: payment.status,
        status: payment.status === 'CONFIRMED' ? 'COMPLETED' : 'STARTED',
        updatedAt: nowIso
      };

      if (payment.status === 'CONFIRMED') {
        update.completedAt = data.completedAt || nowIso;

        const promoCode = String(data.promoCode || '').trim().toUpperCase();
        const alreadyConsumed = !!data.promoUsageConsumed;
        if (promoCode && !alreadyConsumed) {
          const promoRef = db.collection('promoCodes').doc(promoCode);
          const promoSnap = await txn.get(promoRef);
          if (promoSnap.exists) {
            const promo = promoSnap.data() || {};
            const isActive = !!promo.active;
            const expiresAtMs = promo.expiresAt && typeof promo.expiresAt.toDate === 'function'
              ? promo.expiresAt.toDate().getTime()
              : (promo.expiresAt ? new Date(promo.expiresAt).getTime() : null);
            const notExpired = !Number.isFinite(expiresAtMs) || expiresAtMs >= Date.now();
            const usedCount = Number(promo.usedCount || 0);
            const maxUses = Number(promo.maxUses || Number.POSITIVE_INFINITY);

            if (isActive && notExpired && usedCount < maxUses) {
              txn.update(promoRef, {
                usedCount: usedCount + 1,
                updatedAt: nowIso
              });
              update.promoUsageConsumed = true;
              update.promoUsageConsumedAt = nowIso;
            }
          }
        }
      }

      txn.update(ref, update);
      updatedBooking = { id: bookingId, ...data, ...update };
    });

    if (!updatedBooking || !previousBooking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    await cache.set(`booking:${bookingId}`, updatedBooking, 60).catch(() => {});

    emitToUser(previousBooking.userId, 'payment_update', {
      bookingId,
      paymentStatus: updatedBooking.paymentStatus || updatedBooking.payment?.status,
      payment: updatedBooking.payment,
      booking: updatedBooking
    });
    emitToHost(previousBooking.hostId, 'payment_update', {
      bookingId,
      paymentStatus: updatedBooking.paymentStatus || updatedBooking.payment?.status,
      payment: updatedBooking.payment,
      booking: updatedBooking
    });

    // Push notifications (fire-and-forget)
    const newPayStatus = String(updatedBooking.paymentStatus || updatedBooking.payment?.status || '').toUpperCase();
    if (role === 'user') {
      getUserDisplayName(previousBooking.userId).then((userName) => {
        sendPushNotification(previousBooking.hostId, 'Payment confirmed', `${userName} confirmed payment`, { bookingId, deepLink: `/?role=host&tab=dashboard&bookingId=${bookingId}` }).catch(() => {});
      }).catch(() => {});
    } else {
      getUserDisplayName(previousBooking.hostId).then((hostName) => {
        sendPushNotification(previousBooking.userId, 'Receipt confirmed', `${hostName} confirmed cash received`, { bookingId, deepLink: `/?role=user&tab=charge&bookingId=${bookingId}` }).catch(() => {});
      }).catch(() => {});
    }
    if (newPayStatus === 'CONFIRMED') {
      const delay = 30 * 60 * 1000;
      setTimeout(() => {
        sendPushNotification(previousBooking.userId, 'Rate your session', 'How was your experience?', { bookingId, deepLink: `/?role=user&tab=charge&bookingId=${bookingId}&rate=1` }).catch(() => {});
        sendPushNotification(previousBooking.hostId, 'Rate your session', 'How was your experience?', { bookingId, deepLink: `/?role=host&tab=dashboard&bookingId=${bookingId}&rate=1` }).catch(() => {});
      }, delay);
    }

    return res.json({ ok: true, booking: updatedBooking });
  } catch (err) {
    if (err.message === 'NO_ACTIVE_SESSION') {
      return res.status(400).json({ error: 'No active session to confirm' });
    }
    if (err.message === 'ALREADY_CONFIRMED') {
      return res.status(400).json({ error: 'Payment already confirmed by this party' });
    }
    if (err.message === 'BOOKING_NOT_FOUND') {
      return res.status(404).json({ error: 'Booking not found' });
    }
    logger.error('confirmBookingPayment failed', { err: err.message });
    return res.status(500).json({ error: 'Payment confirmation failed' });
  }
}

async function sendBookingMessage(req, res) {
  try {
    const bookingId = String(req.params?.id || '').trim();
    const senderId = String(req.body?.senderId || '').trim();
    const text = String(req.body?.text || '').trim();

    if (!bookingId || !senderId) {
      return res.status(400).json({ success: false, error: 'booking id and senderId are required' });
    }

    if (!text) {
      return res.status(400).json({ success: false, error: 'Message text is required' });
    }

    if (text.length > 500) {
      return res.status(400).json({ success: false, error: 'Message exceeds max length 500' });
    }

    if (!db || mockMode) {
      return res.json({ success: true, message: { senderId, text, createdAt: new Date().toISOString(), readAt: null } });
    }

    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const booking = bookingSnap.data() || {};
    const status = String(booking.status || '').toUpperCase();
    const allowedStatuses = new Set(['BOOKED', 'CONFIRMED', 'STARTED']);
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ success: false, error: 'Chat is disabled for this booking status' });
    }

    if (senderId !== booking.userId && senderId !== booking.hostId) {
      return res.status(403).json({ success: false, error: 'Sender is not part of this booking' });
    }

    const messageRef = bookingRef.collection('messages').doc();
    const payload = {
      senderId,
      text,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      readAt: null
    };

    await messageRef.set(payload);

    return res.status(201).json({ success: true, messageId: messageRef.id });
  } catch (err) {
    logger.error('sendBookingMessage failed', { err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to send message' });
  }
}

function registerRoutes(app) {
  const router = express.Router();
  router.post('/book', requireAuth, createBooking);
  router.get('/booking/:id', requireAuth, updateLastSeenMiddleware, getBooking);
  router.post('/bookings/:id/payment-confirm', requireAuth, updateLastSeenMiddleware, confirmBookingPayment);
  router.post('/bookings/:id/messages', requireAuth, updateLastSeenMiddleware, sendBookingMessage);
  router.get('/bookings/active', requireAuth, updateLastSeenMiddleware, getActiveBooking);
  router.get('/bookings/history', requireAuth, updateLastSeenMiddleware, getBookingHistoryPaginated);
  router.get('/bookings/history/:userId', requireAuth, updateLastSeenMiddleware, getBookingHistory);
  app.use('/api', router);
}

module.exports = { registerRoutes, updateLastSeenMiddleware };
