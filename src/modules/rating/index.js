const express = require('express');
const admin = require('firebase-admin');
const { db, mockMode } = require('../../lib/firestore');
const logger = require('../../lib/logger');
const { requireAuth } = require('../../middleware/auth');

async function submitRating(req, res) {
  try {
    const { bookingId, toUserId, role, stars, comment } = req.body || {};
    const fromUserId = req.user.uid;

    if (!bookingId || !fromUserId || !toUserId || !['user', 'host'].includes(role)) {
      return res.status(400).json({ ok: false, error: 'bookingId, fromUserId, toUserId, and role are required' });
    }

    // stars === null means skip; otherwise validate 1–5
    if (stars !== null && stars !== undefined) {
      const numStars = Number(stars);
      if (!Number.isFinite(numStars) || numStars < 1 || numStars > 5) {
        return res.status(400).json({ ok: false, error: 'stars must be 1–5 or null to skip' });
      }
    }

    const ratingId = `${bookingId}_${fromUserId}`;

    if (!db || mockMode) {
      return res.json({ ok: true, ratingId });
    }

    const starsValue = (stars !== null && stars !== undefined) ? Math.round(Number(stars)) : null;
    const safeComment = String(comment || '').slice(0, 200);

    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      return res.status(404).json({ ok: false, error: 'Booking not found' });
    }
    const booking = bookingSnap.data() || {};

    if (String(booking.status || '').toUpperCase() !== 'COMPLETED') {
      return res.status(400).json({ ok: false, error: 'Booking must be COMPLETED to submit a rating' });
    }

    const bookingUserId = String(booking.userId || '');
    const bookingHostId = String(booking.hostId || '');
    const expectedToUserId = role === 'user' ? bookingHostId : bookingUserId;

    if (String(fromUserId) !== String(role === 'user' ? bookingUserId : bookingHostId)) {
      return res.status(403).json({ ok: false, error: 'fromUserId does not match booking role' });
    }

    if (String(toUserId) !== expectedToUserId) {
      return res.status(400).json({ ok: false, error: 'toUserId must be the opposite party in booking' });
    }

    const ratingRef = db.collection('ratings').doc(ratingId);
    const userRef = db.collection('users').doc(toUserId);

    const txnResult = await db.runTransaction(async (txn) => {
      // All reads must happen before any writes in a Firestore transaction
      const existing = await txn.get(ratingRef);
      if (existing.exists) {
        return { alreadySubmitted: true };
      }

      let userSnap = null;
      if (starsValue !== null) {
        userSnap = await txn.get(userRef);
      }

      // Writes after all reads
      const ratingData = {
        bookingId,
        fromUserId,
        toUserId,
        role,
        stars: starsValue,
        comment: safeComment,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      txn.set(ratingRef, ratingData);

      if (starsValue !== null && userSnap) {
        const data = userSnap.exists ? userSnap.data() : {};
        const prevRating = typeof data.rating === 'number' ? data.rating : 0;
        const prevCount = typeof data.totalRatings === 'number' ? data.totalRatings : 0;
        const newCount = prevCount + 1;
        const newRating = Math.round((((prevRating * prevCount) + starsValue) / newCount) * 10) / 10;
        txn.set(userRef, { rating: newRating, totalRatings: newCount }, { merge: true });
      }

      return { alreadySubmitted: false };
    });

    if (txnResult.alreadySubmitted) {
      return res.status(409).json({ ok: false, error: 'Rating already submitted for this booking', ratingId });
    }

    logger.info('rating.submitted', { ratingId, role, stars: starsValue });
    return res.json({ ok: true, ratingId });
  } catch (err) {
    logger.error('submitRating failed', { error: err.message });
    return res.status(500).json({ ok: false, error: 'Failed to submit rating' });
  }
}

async function getRatingForBooking(req, res) {
  try {
    const { bookingId } = req.params;
    const userId = String(req.query.userId || '').trim();

    if (!bookingId || !userId) {
      return res.status(400).json({ ok: false, error: 'bookingId and userId are required' });
    }

    const ratingId = `${bookingId}_${userId}`;

    if (!db || mockMode) {
      return res.json({ ok: true, rated: false, rating: null });
    }

    const snap = await db.collection('ratings').doc(ratingId).get();
    if (!snap.exists) {
      return res.json({ ok: true, rated: false, rating: null });
    }

    return res.json({ ok: true, rated: true, rating: { id: ratingId, ...snap.data() } });
  } catch (err) {
    logger.error('getRatingForBooking failed', { error: err.message });
    return res.status(500).json({ ok: false, error: 'Failed to fetch rating' });
  }
}

function registerRoutes(app) {
  const router = express.Router();
  router.post('/ratings', requireAuth, submitRating);
  router.get('/ratings/booking/:bookingId', requireAuth, getRatingForBooking);
  app.use('/api', router);
}

module.exports = { registerRoutes };
