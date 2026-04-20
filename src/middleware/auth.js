const admin = require('firebase-admin');
const logger = require('../lib/logger');

const isTest = process.env.NODE_ENV === 'test';

/**
 * Verifies the Firebase ID token from the Authorization header.
 * Sets req.user = { uid, email, phone_number, ... } on success.
 * Returns 401 if the token is missing or invalid.
 *
 * In test environments (NODE_ENV=test), accepts an X-Test-User-Id header
 * to bypass token verification, enabling integration tests without real tokens.
 */
async function requireAuth(req, res, next) {
  if (isTest) {
    const testUid = req.headers['x-test-user-id'];
    if (testUid) {
      req.user = { uid: testUid };
      return next();
    }
  }

  const authHeader = String(req.headers['authorization'] || '');
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded; // { uid, email, phone_number, ... }
    return next();
  } catch (err) {
    logger.warn('requireAuth: token verification failed', { error: err.message });
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Verifies the caller is an admin.
 * Must be used after requireAuth.
 * Checks the custom claim `admin: true` set via Firebase Admin SDK.
 */
async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (!req.user.admin) {
    logger.warn('requireAdmin: access denied', { uid: req.user.uid });
    return res.status(403).json({ error: 'Admin access required' });
  }

  return next();
}

module.exports = { requireAuth, requireAdmin };
