const express = require('express');
const { db, mockMode } = require('../../lib/firestore');
const { sendPushNotification } = require('../../utils/notify');
const { requireAuth } = require('../../middleware/auth');
const router = express.Router();

const VALID_REASONS = ['Fraud', 'No-show', 'Abusive behaviour', 'Incorrect listing', 'Other'];
const VALID_DISPUTE_STATUSES = new Set(['RAISED', 'UNDER_REVIEW', 'RESOLVED']);
const VALID_DISPUTE_REASONS = [
  'User paid but host did not confirm',
  'Host confirmed received but user disputes',
  'Auto-resolved as host absent',
  'Auto-resolved as user absent',
  'Other'
];
const DISPUTE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    const ms = value.toDate().getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

// POST /api/disputes — raise payment dispute (one per booking, within 7 days)
router.post('/disputes', requireAuth, async (req, res) => {
  try {
    const { bookingId, raisedBy, reason, description, evidenceUrl } = req.body || {};

    if (!bookingId || !raisedBy || !reason || !description) {
      return res.status(400).json({ success: false, error: 'bookingId, raisedBy, reason, description are required' });
    }
    if (!VALID_DISPUTE_REASONS.includes(reason)) {
      return res.status(400).json({
        success: false,
        error: `reason must be one of: ${VALID_DISPUTE_REASONS.join(', ')}`
      });
    }
    if (reason === 'Other' && !String(description).trim()) {
      return res.status(400).json({ success: false, error: 'description is required for Other reason' });
    }

    if (!db || mockMode) {
      return res.json({
        success: true,
        disputeId: uid('dsp'),
        alreadyExists: false,
        dispute: {
          status: 'RAISED',
          bookingId,
          raisedBy,
          reason,
          description: String(description).trim(),
          evidenceUrl: String(evidenceUrl || '').trim(),
          resolution: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      });
    }

    const bookingRef = db.collection('bookings').doc(String(bookingId));
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    const booking = bookingSnap.data() || {};
    if (raisedBy !== booking.userId && raisedBy !== booking.hostId) {
      return res.status(403).json({ success: false, error: 'Only booking participants can raise a dispute' });
    }

    const completionMs = toMillis(booking.completedAt) || toMillis(booking.endTime) || toMillis(booking.createdAt);
    if (!completionMs) {
      return res.status(400).json({ success: false, error: 'Booking completion time unavailable for dispute window check' });
    }
    if ((Date.now() - completionMs) > DISPUTE_WINDOW_MS) {
      return res.status(400).json({ success: false, error: 'Dispute window has expired (7 days)' });
    }

    const existingSnap = await db.collection('disputes')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();
    if (!existingSnap.empty) {
      const existingDoc = existingSnap.docs[0];
      const existingData = existingDoc.data() || {};
      const existingStatus = String(existingData.status || '').toUpperCase();
      return res.json({
        success: true,
        alreadyExists: true,
        disputeId: existingData.disputeId || existingDoc.id,
        dispute: {
          ...existingData,
          disputeId: existingData.disputeId || existingDoc.id,
          status: VALID_DISPUTE_STATUSES.has(existingStatus) ? existingStatus : 'RAISED'
        }
      });
    }

    const disputeId = uid('dsp');
    const nowIso = new Date().toISOString();
    const disputeData = {
      disputeId,
      bookingId,
      raisedBy,
      reason,
      description: String(description).trim(),
      evidenceUrl: String(evidenceUrl || '').trim(),
      status: 'RAISED',
      resolution: null,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    await db.collection('disputes').doc(disputeId).set(disputeData);

    const otherPartyId = raisedBy === booking.userId ? booking.hostId : booking.userId;
    const adminFcmUserId = String(process.env.ADMIN_FCM_USER_ID || '').trim();
    const notifyTasks = [];

    if (otherPartyId) {
      notifyTasks.push(sendPushNotification(
        otherPartyId,
        'Payment dispute raised',
        'A payment dispute has been raised for a completed session.',
        {
          bookingId,
          disputeId,
          status: 'RAISED',
          deepLink: raisedBy === booking.userId
            ? `/?role=host&tab=dashboard&bookingId=${bookingId}`
            : `/?role=user&tab=charge&bookingId=${bookingId}`
        }
      ));
    }

    if (adminFcmUserId) {
      notifyTasks.push(sendPushNotification(
        adminFcmUserId,
        'New payment dispute',
        `Dispute ${disputeId} raised for booking ${bookingId}.`,
        { bookingId, disputeId, status: 'RAISED', deepLink: '/admin' }
      ));
    }

    await Promise.allSettled(notifyTasks);

    return res.json({ success: true, alreadyExists: false, disputeId, dispute: disputeData });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to raise dispute' });
  }
});

// GET /api/disputes/booking/:bookingId — fetch dispute status for booking
router.get('/disputes/booking/:bookingId', requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!bookingId) {
      return res.status(400).json({ success: false, error: 'bookingId is required' });
    }

    if (!db || mockMode) {
      return res.json({ success: true, dispute: null });
    }

    const snap = await db.collection('disputes')
      .where('bookingId', '==', bookingId)
      .limit(1)
      .get();
    if (snap.empty) {
      return res.json({ success: true, dispute: null });
    }

    const doc = snap.docs[0];
    const data = doc.data() || {};
    const status = String(data.status || '').toUpperCase();

    return res.json({
      success: true,
      dispute: {
        ...data,
        disputeId: data.disputeId || doc.id,
        status: VALID_DISPUTE_STATUSES.has(status) ? status : 'RAISED'
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch dispute' });
  }
});

// POST /api/reports — submit a report (one per booking per reporter)
router.post('/reports', requireAuth, async (req, res) => {
  try {
    const { reportedBy, reportedUserId, bookingId, reason, details } = req.body || {};

    if (!reportedBy || !reportedUserId || !bookingId || !reason) {
      return res.status(400).json({ success: false, error: 'reportedBy, reportedUserId, bookingId, reason are required' });
    }
    if (!VALID_REASONS.includes(reason)) {
      return res.status(400).json({ success: false, error: `reason must be one of: ${VALID_REASONS.join(', ')}` });
    }
    if (reason === 'Other' && (!details || !details.trim())) {
      return res.status(400).json({ success: false, error: 'details is required when reason is "Other"' });
    }
    if (reportedBy === reportedUserId) {
      return res.status(400).json({ success: false, error: 'Cannot report yourself' });
    }

    if (!db || mockMode) {
      return res.json({ success: true, reportId: uid('rep'), alreadyReported: false });
    }

    // Idempotency: one report per booking per reporter
    const existingSnap = await db.collection('reports')
      .where('bookingId', '==', bookingId)
      .where('reportedBy', '==', reportedBy)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return res.json({ success: true, alreadyReported: true });
    }

    const reportId = uid('rep');
    await db.collection('reports').doc(reportId).set({
      reportId,
      reportedBy,
      reportedUserId,
      bookingId,
      reason,
      details: details ? details.trim() : '',
      createdAt: new Date().toISOString(),
      status: 'pending'
    });

    return res.json({ success: true, reportId, alreadyReported: false });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to submit report' });
  }
});

// POST /api/blocks — host blocks a user
router.post('/blocks', requireAuth, async (req, res) => {
  try {
    const { hostId, blockedUserId } = req.body || {};

    if (!hostId || !blockedUserId) {
      return res.status(400).json({ success: false, error: 'hostId and blockedUserId are required' });
    }
    if (hostId === blockedUserId) {
      return res.status(400).json({ success: false, error: 'Cannot block yourself' });
    }

    if (!db || mockMode) {
      return res.json({ success: true, blockId: uid('blk'), alreadyBlocked: false });
    }

    // Idempotency: one block per host+user pair
    const existingSnap = await db.collection('blocks')
      .where('hostId', '==', hostId)
      .where('blockedUserId', '==', blockedUserId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return res.json({ success: true, blockId: existingSnap.docs[0].id, alreadyBlocked: true });
    }

    const blockId = uid('blk');
    await db.collection('blocks').doc(blockId).set({
      blockId,
      hostId,
      blockedUserId,
      createdAt: new Date().toISOString()
    });

    return res.json({ success: true, blockId, alreadyBlocked: false });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to block user' });
  }
});

// DELETE /api/blocks/:blockedUserId?hostId= — host unblocks a user
router.delete('/blocks/:blockedUserId', requireAuth, async (req, res) => {
  try {
    const { blockedUserId } = req.params;
    const { hostId } = req.query;

    if (!hostId || !blockedUserId) {
      return res.status(400).json({ success: false, error: 'hostId query param and blockedUserId path param are required' });
    }

    if (!db || mockMode) {
      return res.json({ success: true });
    }

    const snap = await db.collection('blocks')
      .where('hostId', '==', hostId)
      .where('blockedUserId', '==', blockedUserId)
      .limit(1)
      .get();

    if (snap.empty) {
      return res.json({ success: true, wasBlocked: false });
    }

    await snap.docs[0].ref.delete();
    return res.json({ success: true, wasBlocked: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to unblock user' });
  }
});

// GET /api/blocks?hostId= — list all users blocked by a host
router.get('/blocks', requireAuth, async (req, res) => {
  try {
    const { hostId } = req.query;

    if (!hostId) {
      return res.status(400).json({ success: false, error: 'hostId is required' });
    }

    if (!db || mockMode) {
      return res.json({ success: true, blocks: [] });
    }

    const snap = await db.collection('blocks')
      .where('hostId', '==', hostId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    const blocks = snap.docs.map(doc => {
      const d = doc.data();
      return { blockId: d.blockId || doc.id, blockedUserId: d.blockedUserId, createdAt: d.createdAt };
    });

    // Enrich with user display names
    const enriched = await Promise.all(blocks.map(async (b) => {
      try {
        const userSnap = await db.collection('users').doc(b.blockedUserId).get();
        const userData = userSnap.data() || {};
        return { ...b, displayName: userData.name || userData.displayName || b.blockedUserId };
      } catch {
        return { ...b, displayName: b.blockedUserId };
      }
    }));

    return res.json({ success: true, blocks: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to fetch blocks' });
  }
});

// POST /api/promo/validate — validate promo code and return discount details
router.post('/promo/validate', requireAuth, async (req, res) => {
  try {
    const { code } = req.body || {};

    if (!code || !String(code).trim()) {
      return res.status(400).json({ success: false, error: 'Code is required' });
    }

    const trimmedCode = String(code).trim().toUpperCase();

    if (!db || mockMode) {
      return res.json({
        success: true,
        discount: {
          type: 'percent',
          value: 10,
          code: trimmedCode
        }
      });
    }

    try {
      const promoSnap = await db.collection('promoCodes').doc(trimmedCode).get();
      if (!promoSnap.exists) {
        return res.status(404).json({ success: false, error: 'Promo code not found' });
      }

      const promoData = promoSnap.data() || {};
      
      if (!promoData.active) {
        return res.status(400).json({ success: false, error: 'Promo code is no longer active' });
      }

      const expiresAtMs = promoData.expiresAt ? toMillis(promoData.expiresAt) : null;
      if (expiresAtMs && expiresAtMs < Date.now()) {
        return res.status(400).json({ success: false, error: 'Promo code has expired' });
      }

      const usedCount = Number(promoData.usedCount || 0);
      const maxUses = Number(promoData.maxUses || Infinity);
      if (usedCount >= maxUses) {
        return res.status(400).json({ success: false, error: 'Promo code usage limit reached' });
      }

      return res.json({
        success: true,
        discount: {
          type: promoData.type || 'flat',
          value: Number(promoData.value || 0),
          code: trimmedCode
        }
      });
    } catch (dbErr) {
      return res.status(500).json({ success: false, error: 'Failed to validate code' });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Code validation failed' });
  }
});

// Helper: Apply promo discount to finalAmount (usage is consumed on successful payment confirmation)
async function applyPromoDiscount(bookingRef, promoCode, finalAmount) {
  if (!promoCode || !bookingRef || !db || mockMode) {
    return finalAmount;
  }

  const trimmedCode = String(promoCode).trim().toUpperCase();

  try {
    const promoSnap = await db.collection('promoCodes').doc(trimmedCode).get();
    if (!promoSnap.exists) {
      return finalAmount;
    }

    const promoData = promoSnap.data() || {};
    if (!promoData.active) {
      return finalAmount;
    }

    const expiresAtMs = promoData.expiresAt ? toMillis(promoData.expiresAt) : null;
    if (expiresAtMs && expiresAtMs < Date.now()) {
      return finalAmount;
    }

    const type = promoData.type || 'flat';
    const value = Number(promoData.value || 0);
    let discountedAmount = Number(finalAmount);

    if (type === 'percent') {
      const discountAmount = (finalAmount * value) / 100;
      discountedAmount = Math.max(0, finalAmount - discountAmount);
    } else if (type === 'flat') {
      discountedAmount = Math.max(0, finalAmount - value);
    }

    return Math.round(discountedAmount * 100) / 100; // Round to 2 decimals
  } catch (err) {
    // Silently fail and return original amount
    return finalAmount;
  }
}

function registerRoutes(app) {
  app.use('/api', router);
}

module.exports = { registerRoutes, applyPromoDiscount };
