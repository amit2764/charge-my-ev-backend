/**
 * Cash Payment Fraud-Resistant System
 * Handles cash payments with double confirmation, trust score penalties, and auto dispute resolution
 */

const { db, mockMode } = require('./config/firebase');
const { notifyPaymentConfirmationRequired, notifyPaymentDispute, notifyPaymentResolved } = require('./notifications');
const { updateUserTrustScore, getUserTrustProfile } = require('./trust-score');
const { trackBookingFailure } = require('./monitoring');

// Mock storage for cash payments
let mockCashPayments = new Map();

// Payment states
const PAYMENT_STATES = {
  PENDING: 'PENDING',           // Waiting for confirmations
  USER_CONFIRMED: 'USER_CONFIRMED',   // User confirmed payment
  HOST_CONFIRMED: 'HOST_CONFIRMED',   // Host confirmed receipt
  CONFIRMED: 'CONFIRMED',       // Both confirmed
  DISPUTED: 'DISPUTED',         // Dispute raised
  RESOLVED: 'RESOLVED',         // Dispute resolved
  CANCELLED: 'CANCELLED'        // Payment cancelled
};

// Dispute resolution outcomes
const DISPUTE_RESOLUTIONS = {
  USER_FAULT: 'USER_FAULT',     // User didn't pay, penalty to user
  HOST_FAULT: 'HOST_FAULT',     // Host falsely claimed, penalty to host
  SPLIT: 'SPLIT',              // Both parties at fault, split penalty
  NO_FAULT: 'NO_FAULT',        // No fault determined, no penalty
  ADMIN_OVERRIDE: 'ADMIN_OVERRIDE' // Admin resolved manually
};

// Configuration
const PAYMENT_CONFIG = {
  CONFIRMATION_TIMEOUT_HOURS: 24,    // Hours to wait for confirmations
  DISPUTE_TIMEOUT_HOURS: 48,         // Hours to wait before auto-resolution
  TRUST_SCORE_PENALTY_USER: -10,     // Penalty for user not paying
  TRUST_SCORE_PENALTY_HOST: -15,     // Penalty for host false claim (higher penalty)
  TRUST_SCORE_PENALTY_SPLIT: -5,     // Split penalty
  MIN_TRUST_SCORE_THRESHOLD: 20      // Minimum trust score to avoid auto-penalty
};

/**
 * Initialize cash payment tracking after session completion
 * @param {string} bookingId - Booking ID
 * @param {object} booking - Booking data
 * @returns {Promise<object>} Initialization result
 */
async function initializeCashPayment(bookingId, booking) {
  try {
    const paymentData = {
      bookingId,
      userId: booking.userId,
      hostId: booking.hostId,
      amount: booking.finalAmount || booking.price,
      status: PAYMENT_STATES.PENDING,
      createdAt: new Date(),
      userConfirmation: null,
      hostConfirmation: null,
      confirmationsRequired: true,
      dispute: null,
      resolvedAt: null,
      resolution: null,
      trustScoreImpacts: null
    };

    if (mockMode) {
      mockCashPayments.set(bookingId, paymentData);
    } else {
      await db.collection('cash_payments').doc(bookingId).set(paymentData);
    }

    // Notify both parties to confirm payment
    await notifyPaymentConfirmationRequired(bookingId, booking.userId, booking.hostId, paymentData.amount);

    console.log(`[CASH-PAYMENT] Initialized payment tracking for booking ${bookingId}`);
    return { success: true, payment: paymentData };

  } catch (error) {
    console.error('Error initializing cash payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Confirm payment by user or host
 * @param {string} bookingId - Booking ID
 * @param {string} confirmerId - ID of user/host confirming
 * @param {string} role - 'user' or 'host'
 * @param {boolean} confirmed - Whether payment was made/received
 * @param {string} notes - Optional notes
 * @returns {Promise<object>} Confirmation result
 */
async function confirmPayment(bookingId, confirmerId, role, confirmed, notes = '') {
  try {
    // Get current payment data
    let payment = null;
    if (mockMode) {
      payment = mockCashPayments.get(bookingId);
    } else {
      const doc = await db.collection('cash_payments').doc(bookingId).get();
      if (doc.exists) {
        payment = { id: doc.id, ...doc.data() };
      }
    }

    if (!payment) {
      return { success: false, error: 'Payment record not found' };
    }

    // Validate confirmer
    if (role === 'user' && confirmerId !== payment.userId) {
      return { success: false, error: 'Unauthorized: Only the user can confirm payment' };
    }
    if (role === 'host' && confirmerId !== payment.hostId) {
      return { success: false, error: 'Unauthorized: Only the host can confirm receipt' };
    }

    // Check if already in final state
    if ([PAYMENT_STATES.CONFIRMED, PAYMENT_STATES.RESOLVED, PAYMENT_STATES.CANCELLED].includes(payment.status)) {
      return { success: false, error: 'Payment is already finalized' };
    }

    const confirmationData = {
      confirmed,
      confirmedAt: new Date(),
      confirmedBy: confirmerId,
      notes
    };

    let newStatus = payment.status;

    // Update confirmation based on role
    if (role === 'user') {
      payment.userConfirmation = confirmationData;
      if (confirmed) {
        newStatus = payment.hostConfirmation ? PAYMENT_STATES.CONFIRMED : PAYMENT_STATES.USER_CONFIRMED;
      } else {
        // User says they didn't pay - this triggers dispute
        newStatus = PAYMENT_STATES.DISPUTED;
        payment.dispute = {
          raisedBy: confirmerId,
          raisedAt: new Date(),
          reason: 'User claims payment not made',
          notes
        };
      }
    } else if (role === 'host') {
      payment.hostConfirmation = confirmationData;
      if (confirmed) {
        newStatus = payment.userConfirmation ? PAYMENT_STATES.CONFIRMED : PAYMENT_STATES.HOST_CONFIRMED;
      } else {
        // Host says they didn't receive - triggers dispute
        newStatus = PAYMENT_STATES.DISPUTED;
        payment.dispute = {
          raisedBy: confirmerId,
          raisedAt: new Date(),
          reason: 'Host claims payment not received',
          notes
        };
      }
    }

    // Update payment record
    payment.status = newStatus;
    payment.updatedAt = new Date();

    if (mockMode) {
      mockCashPayments.set(bookingId, payment);
    } else {
      await db.collection('cash_payments').doc(bookingId).update({
        status: newStatus,
        userConfirmation: payment.userConfirmation,
        hostConfirmation: payment.hostConfirmation,
        dispute: payment.dispute,
        updatedAt: new Date()
      });
    }

    // Handle state transitions
    if (newStatus === PAYMENT_STATES.CONFIRMED) {
      await handlePaymentConfirmed(payment);
    } else if (newStatus === PAYMENT_STATES.DISPUTED) {
      await handlePaymentDisputed(payment);
    }

    console.log(`[CASH-PAYMENT] ${role} ${confirmed ? 'confirmed' : 'disputed'} payment for booking ${bookingId}`);
    return { success: true, payment };

  } catch (error) {
    console.error('Error confirming payment:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle payment confirmed state
 * @param {object} payment - Payment data
 */
async function handlePaymentConfirmed(payment) {
  // Notify both parties of successful confirmation
  await notifyPaymentResolved(payment.bookingId, payment.userId, payment.hostId, 'confirmed', payment.amount);
  console.log(`[CASH-PAYMENT] Payment confirmed for booking ${payment.bookingId}`);
}

/**
 * Handle payment disputed state
 * @param {object} payment - Payment data
 */
async function handlePaymentDisputed(payment) {
  // Track payment dispute as booking failure
  await trackBookingFailure(payment.userId, payment.hostId, 'PAYMENT_DISPUTED', payment.dispute.reason, {
    bookingId: payment.bookingId,
    amount: payment.amount,
    disputeRaisedBy: payment.dispute.raisedBy
  });

  // Notify both parties of dispute
  await notifyPaymentDispute(payment.bookingId, payment.userId, payment.hostId, payment.dispute.reason);

  // Schedule auto-resolution after timeout
  setTimeout(async () => {
    await autoResolveDispute(payment.bookingId);
  }, PAYMENT_CONFIG.DISPUTE_TIMEOUT_HOURS * 60 * 60 * 1000);

  console.log(`[CASH-PAYMENT] Payment disputed for booking ${payment.bookingId}: ${payment.dispute.reason}`);
}

/**
 * Auto-resolve dispute based on trust scores
 * @param {string} bookingId - Booking ID
 * @returns {Promise<object>} Resolution result
 */
async function autoResolveDispute(bookingId) {
  try {
    // Get current payment data
    let payment = null;
    if (mockMode) {
      payment = mockCashPayments.get(bookingId);
    } else {
      const doc = await db.collection('cash_payments').doc(bookingId).get();
      if (doc.exists) {
        payment = { id: doc.id, ...doc.data() };
      }
    }

    if (!payment || payment.status !== PAYMENT_STATES.DISPUTED) {
      return { success: false, error: 'Payment not in disputed state' };
    }

    // Get trust profiles
    const userProfile = await getUserTrustProfile(payment.userId);
    const hostProfile = await getUserTrustProfile(payment.hostId);

    if (!userProfile.success || !hostProfile.success) {
      console.warn(`[CASH-PAYMENT] Could not retrieve trust profiles for auto-resolution of ${bookingId}`);
      return { success: false, error: 'Trust profiles unavailable' };
    }

    const userScore = userProfile.profile.trustScore;
    const hostScore = hostProfile.profile.trustScore;

    let resolution;
    let penalties = {};

    // Determine resolution based on trust scores and dispute type
    if (payment.dispute.raisedBy === payment.userId) {
      // User disputed (claimed they paid but host says no)
      if (userScore > hostScore + 10) {
        // User has significantly higher trust score - likely host is at fault
        resolution = DISPUTE_RESOLUTIONS.HOST_FAULT;
        penalties[payment.hostId] = PAYMENT_CONFIG.TRUST_SCORE_PENALTY_HOST;
      } else if (hostScore > userScore + 10) {
        // Host has significantly higher trust score - likely user is at fault
        resolution = DISPUTE_RESOLUTIONS.USER_FAULT;
        penalties[payment.userId] = PAYMENT_CONFIG.TRUST_SCORE_PENALTY_USER;
      } else {
        // Similar trust scores - split decision
        resolution = DISPUTE_RESOLUTIONS.SPLIT;
        penalties[payment.userId] = PAYMENT_CONFIG.TRUST_SCORE_PENALTY_SPLIT;
        penalties[payment.hostId] = PAYMENT_CONFIG.TRUST_SCORE_PENALTY_SPLIT;
      }
    } else {
      // Host disputed (claimed not received but user says paid)
      if (hostScore > userScore + 10) {
        resolution = DISPUTE_RESOLUTIONS.USER_FAULT;
        penalties[payment.userId] = PAYMENT_CONFIG.TRUST_SCORE_PENALTY_USER;
      } else if (userScore > hostScore + 10) {
        resolution = DISPUTE_RESOLUTIONS.HOST_FAULT;
        penalties[payment.hostId] = PAYMENT_CONFIG.TRUST_SCORE_PENALTY_HOST;
      } else {
        resolution = DISPUTE_RESOLUTIONS.SPLIT;
        penalties[payment.userId] = PAYMENT_CONFIG.TRUST_SCORE_PENALTY_SPLIT;
        penalties[payment.hostId] = PAYMENT_CONFIG.TRUST_SCORE_PENALTY_SPLIT;
      }
    }

    // Apply penalties
    for (const [userId, penalty] of Object.entries(penalties)) {
      await applyTrustScorePenalty(userId, penalty, `Cash payment dispute resolution: ${resolution}`);
    }

    // Update payment record
    payment.status = PAYMENT_STATES.RESOLVED;
    payment.resolution = resolution;
    payment.resolvedAt = new Date();
    payment.trustScoreImpacts = penalties;

    if (mockMode) {
      mockCashPayments.set(bookingId, payment);
    } else {
      await db.collection('cash_payments').doc(bookingId).update({
        status: PAYMENT_STATES.RESOLVED,
        resolution,
        resolvedAt: new Date(),
        trustScoreImpacts: penalties
      });
    }

    // Notify parties of resolution
    await notifyPaymentResolved(bookingId, payment.userId, payment.hostId, resolution, payment.amount, penalties);

    console.log(`[CASH-PAYMENT] Auto-resolved dispute for booking ${bookingId}: ${resolution}`);
    return { success: true, resolution, penalties };

  } catch (error) {
    console.error('Error auto-resolving dispute:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Apply trust score penalty
 * @param {string} userId - User ID
 * @param {number} penalty - Penalty amount
 * @param {string} reason - Reason for penalty
 */
async function applyTrustScorePenalty(userId, penalty, reason) {
  try {
    const profile = await getUserTrustProfile(userId);
    if (!profile.success) {
      console.warn(`Could not apply penalty to user ${userId}: profile not found`);
      return;
    }

    const newScore = Math.max(0, profile.profile.trustScore + penalty); // Don't go below 0

    await updateUserTrustScore(userId, {
      completionRate: profile.profile.completionRate,
      cancellationRate: profile.profile.cancellationRate,
      averageRating: profile.profile.averageRating,
      penalty: penalty,
      penaltyReason: reason
    });

    console.log(`[TRUST-SCORE] Applied penalty of ${penalty} to user ${userId} for: ${reason}`);
  } catch (error) {
    console.error('Error applying trust score penalty:', error);
  }
}

/**
 * Manually resolve dispute (admin function)
 * @param {string} bookingId - Booking ID
 * @param {string} resolution - Resolution type
 * @param {object} penalties - Penalty overrides
 * @param {string} adminNotes - Admin notes
 * @returns {Promise<object>} Resolution result
 */
async function manuallyResolveDispute(bookingId, resolution, penalties = {}, adminNotes = '') {
  try {
    let payment = null;
    if (mockMode) {
      payment = mockCashPayments.get(bookingId);
    } else {
      const doc = await db.collection('cash_payments').doc(bookingId).get();
      if (doc.exists) {
        payment = { id: doc.id, ...doc.data() };
      }
    }

    if (!payment || payment.status !== PAYMENT_STATES.DISPUTED) {
      return { success: false, error: 'Payment not in disputed state' };
    }

    // Apply penalties
    for (const [userId, penalty] of Object.entries(penalties)) {
      await applyTrustScorePenalty(userId, penalty, `Manual dispute resolution: ${resolution} - ${adminNotes}`);
    }

    // Update payment record
    payment.status = PAYMENT_STATES.RESOLVED;
    payment.resolution = DISPUTE_RESOLUTIONS.ADMIN_OVERRIDE;
    payment.resolvedAt = new Date();
    payment.trustScoreImpacts = penalties;
    payment.adminResolution = {
      resolution,
      penalties,
      adminNotes,
      resolvedAt: new Date()
    };

    if (mockMode) {
      mockCashPayments.set(bookingId, payment);
    } else {
      await db.collection('cash_payments').doc(bookingId).update({
        status: PAYMENT_STATES.RESOLVED,
        resolution: DISPUTE_RESOLUTIONS.ADMIN_OVERRIDE,
        resolvedAt: new Date(),
        trustScoreImpacts: penalties,
        adminResolution: payment.adminResolution
      });
    }

    // Notify parties
    await notifyPaymentResolved(bookingId, payment.userId, payment.hostId, resolution, payment.amount, penalties, adminNotes);

    console.log(`[CASH-PAYMENT] Manually resolved dispute for booking ${bookingId}: ${resolution}`);
    return { success: true, resolution, penalties };

  } catch (error) {
    console.error('Error manually resolving dispute:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get payment status
 * @param {string} bookingId - Booking ID
 * @returns {Promise<object>} Payment status
 */
async function getPaymentStatus(bookingId) {
  try {
    let payment = null;
    if (mockMode) {
      payment = mockCashPayments.get(bookingId);
    } else {
      const doc = await db.collection('cash_payments').doc(bookingId).get();
      if (doc.exists) {
        payment = { id: doc.id, ...doc.data() };
      }
    }

    if (!payment) {
      return { success: false, error: 'Payment record not found' };
    }

    return { success: true, payment };

  } catch (error) {
    console.error('Error getting payment status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check for expired confirmations and auto-dispute
 * @returns {Promise<object>} Check results
 */
async function checkExpiredConfirmations() {
  try {
    const cutoffTime = new Date(Date.now() - PAYMENT_CONFIG.CONFIRMATION_TIMEOUT_HOURS * 60 * 60 * 1000);
    let expiredPayments = [];

    if (mockMode) {
      for (const [bookingId, payment] of mockCashPayments) {
        if (payment.status === PAYMENT_STATES.PENDING && payment.createdAt < cutoffTime) {
          expiredPayments.push(payment);
        }
      }
    } else {
      const snapshot = await db.collection('cash_payments')
        .where('status', '==', PAYMENT_STATES.PENDING)
        .where('createdAt', '<', cutoffTime)
        .get();

      snapshot.forEach(doc => {
        expiredPayments.push({ id: doc.id, ...doc.data() });
      });
    }

    // Auto-dispute expired payments
    for (const payment of expiredPayments) {
      await confirmPayment(payment.bookingId, 'SYSTEM', 'system', false, 'Confirmation timeout - auto-disputed');
    }

    return {
      success: true,
      expiredCount: expiredPayments.length,
      autoDisputed: expiredPayments.length
    };

  } catch (error) {
    console.error('Error checking expired confirmations:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  initializeCashPayment,
  confirmPayment,
  autoResolveDispute,
  manuallyResolveDispute,
  getPaymentStatus,
  checkExpiredConfirmations,
  PAYMENT_STATES,
  DISPUTE_RESOLUTIONS,
  PAYMENT_CONFIG
};