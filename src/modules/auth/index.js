const express = require('express');
const logger = require('../../lib/logger');
const rateLimiter = require('../../lib/rateLimiter');
const { db, mockMode } = require('../../lib/firestore');
const { requireAuth } = require('../../middleware/auth');

// Apply strict rate limiting to OTP sends to prevent abuse
const sendOtpLimiter = rateLimiter({ prefix: 'otp_send', windowSec: 60, max: 5 });

async function sendOtp(req, res) {
  // stub: delegate to real auth service
  res.json({ success: true, message: 'OTP sent (stub)' });
}

// Looser limiter for verify attempts
const verifyOtpLimiter = rateLimiter({ prefix: 'otp_verify', windowSec: 60, max: 10 });
async function verifyOtp(req, res) {
  res.json({ success: true, message: 'OTP verified (stub)' });
}

async function storeFcmToken(req, res) {
  try {
    const userId = req.user.uid;
    const fcmToken = String(req.body?.fcmToken || '').trim();

    if (!fcmToken) {
      return res.status(400).json({ success: false, error: 'fcmToken is required' });
    }

    if (!db || mockMode) {
      return res.json({ success: true });
    }

    await db.collection('users').doc(userId).set(
      { fcmToken, fcmUpdatedAt: new Date().toISOString() },
      { merge: true }
    );

    logger.info('auth.storeFcmToken', { userId });
    return res.json({ success: true });
  } catch (err) {
    logger.warn('auth.storeFcmToken.failed', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to store FCM token' });
  }
}

function registerRoutes(app) {
  const router = express.Router();
  router.post('/auth/send-otp', sendOtpLimiter, sendOtp);
  router.post('/auth/verify-otp', verifyOtpLimiter, verifyOtp);
  router.post('/auth/fcm-token', requireAuth, storeFcmToken);
  app.use('/api', router);
}

module.exports = { registerRoutes };
