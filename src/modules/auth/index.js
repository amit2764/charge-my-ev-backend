const express = require('express');
const logger = require('../../lib/logger');
const rateLimiter = require('../../lib/rateLimiter');

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

function registerRoutes(app) {
  const router = express.Router();
  router.post('/auth/send-otp', sendOtpLimiter, sendOtp);
  router.post('/auth/verify-otp', verifyOtpLimiter, verifyOtp);
  app.use('/api', router);
}

module.exports = { registerRoutes };
