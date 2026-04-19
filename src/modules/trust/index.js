const { db, mockMode } = require('../../lib/firestore');
const cache = require('../../lib/cache');
const logger = require('../../lib/logger');

async function submitRating(req, res) {
  try {
    const { bookingId, userId, hostId, rating, review, aspects } = req.body || {};

    if (!bookingId || !userId || !hostId || rating === undefined) {
      return res.status(400).json({
        success: false,
        error: 'bookingId, userId, hostId, and rating are required'
      });
    }

    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({
        success: false,
        error: 'Rating must be between 1 and 5'
      });
    }

    const ratingData = {
      bookingId,
      userId,
      hostId,
      rating: Math.round(numericRating),
      review: review || '',
      aspects: aspects || {},
      createdAt: new Date().toISOString()
    };

    const ratingId = `${bookingId}_${userId}`;

    if (!db || mockMode) {
      global.mockRatings = global.mockRatings || new Map();
      if (global.mockRatings.has(ratingId)) {
        return res.status(409).json({ success: false, error: 'Rating already submitted for this booking' });
      }
      global.mockRatings.set(ratingId, ratingData);
      await updateTrustForRating(userId, hostId, ratingData.rating);
      return res.json({ success: true, rating: { id: ratingId, ...ratingData } });
    }

    const ratingRef = db.collection('ratings').doc(ratingId);
    const existing = await ratingRef.get();
    if (existing.exists) {
      return res.status(409).json({ success: false, error: 'Rating already submitted for this booking' });
    }

    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    await Promise.all([
      ratingRef.set(ratingData),
      bookingRef.set(
        {
          hostRating: ratingData.rating,
          hostReview: ratingData.review,
          ratedAt: ratingData.createdAt,
          updatedAt: ratingData.createdAt
        },
        { merge: true }
      )
    ]);

    await updateTrustForRating(userId, hostId, ratingData.rating);

    return res.json({ success: true, rating: { id: ratingId, ...ratingData } });
  } catch (err) {
    logger.error('submitRating failed', { err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to submit rating' });
  }
}

async function getTrustProfile(userId) {
  const key = `trust:${userId}`;
  return cache.memoize(key, 300, async () => {
    if (!db || mockMode) {
      return { metrics: { averageRating: 0, totalRatings: 0 }, lastUpdated: new Date() };
    }
    const doc = await db.collection('trust_profiles').doc(userId).get();
    return doc.exists ? doc.data() : { metrics: { averageRating: 0, totalRatings: 0 } };
  });
}

async function updateTrustForRating(userId, hostId, rating) {
  try {
    if (!db || mockMode) {
      // In mock mode just update cache
      const userProfile = await getTrustProfile(userId);
      const hostProfile = await getTrustProfile(hostId);
      // simple aggregation in mock
      userProfile.metrics.totalRatings = (userProfile.metrics.totalRatings || 0) + 1;
      userProfile.metrics.averageRating = ((userProfile.metrics.averageRating || 0) * (userProfile.metrics.totalRatings - 1) + rating) / userProfile.metrics.totalRatings;
      hostProfile.metrics.totalRatings = (hostProfile.metrics.totalRatings || 0) + 1;
      hostProfile.metrics.averageRating = ((hostProfile.metrics.averageRating || 0) * (hostProfile.metrics.totalRatings - 1) + rating) / hostProfile.metrics.totalRatings;
      await cache.set(`trust:${userId}`, userProfile, 300);
      await cache.set(`trust:${hostId}`, hostProfile, 300);
      return { userProfile, hostProfile };
    }

    // Read current profiles
    const userRef = db.collection('trust_profiles').doc(userId);
    const hostRef = db.collection('trust_profiles').doc(hostId);
    const [userSnap, hostSnap] = await Promise.all([userRef.get(), hostRef.get()]);

    const userData = userSnap.exists ? userSnap.data() : { metrics: { averageRating: 0, totalRatings: 0 } };
    const hostData = hostSnap.exists ? hostSnap.data() : { metrics: { averageRating: 0, totalRatings: 0 } };

    const uCount = (userData.metrics?.totalRatings || 0) + 1;
    const uAvg = ((userData.metrics?.averageRating || 0) * (uCount - 1) + rating) / uCount;

    const hCount = (hostData.metrics?.totalRatings || 0) + 1;
    const hAvg = ((hostData.metrics?.averageRating || 0) * (hCount - 1) + rating) / hCount;

    const now = new Date();
    await Promise.all([
      userRef.set({ metrics: { averageRating: uAvg, totalRatings: uCount }, lastUpdated: now }, { merge: true }),
      hostRef.set({ metrics: { averageRating: hAvg, totalRatings: hCount }, lastUpdated: now }, { merge: true })
    ]);

    const userProfile = { metrics: { averageRating: uAvg, totalRatings: uCount }, lastUpdated: now };
    const hostProfile = { metrics: { averageRating: hAvg, totalRatings: hCount }, lastUpdated: now };

    // Update caches
    await cache.set(`trust:${userId}`, userProfile, 300);
    await cache.set(`trust:${hostId}`, hostProfile, 300);

    return { userProfile, hostProfile };
  } catch (err) {
    logger.error('updateTrustForRating failed', { err: err.message });
    throw err;
  }
}

function registerRoutes(app) {
  const router = require('express').Router();
  router.post('/rating', submitRating);
  router.get('/trust/:id', async (req, res) => {
    try {
      const profile = await getTrustProfile(req.params.id);
      res.json({ success: true, profile });
    } catch (err) {
      res.status(500).json({ success: false });
    }
  });
  app.use('/api', router);
}

module.exports = { getTrustProfile, updateTrustForRating, registerRoutes };
