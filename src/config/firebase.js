const admin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

// Support either raw private key or base64-encoded private key to avoid newline issues in env
const firebasePrivateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
const firebasePrivateKeyB64 = process.env.FIREBASE_PRIVATE_KEY_B64;

let resolvedPrivateKey;
if (firebasePrivateKeyRaw) {
  resolvedPrivateKey = firebasePrivateKeyRaw.replace(/\\n/g, '\n');
} else if (firebasePrivateKeyB64) {
  try {
    resolvedPrivateKey = Buffer.from(firebasePrivateKeyB64, 'base64').toString('utf8');
  } catch (err) {
    console.warn('Failed to decode FIREBASE_PRIVATE_KEY_B64:', err.message);
  }
}

// Check if Firebase credentials are properly configured
const hasValidCredentials = Boolean(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  resolvedPrivateKey &&
  !resolvedPrivateKey.includes('your_private_key')
);

let db = null;
const mockMode = !hasValidCredentials;

if (hasValidCredentials) {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: resolvedPrivateKey,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    db = admin.firestore();
    console.log('Firebase initialized successfully');
  } catch (error) {
    console.warn('Firebase initialization failed:', error.message);
    console.warn('Running in mock mode - set FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY in .env');
  }
} else {
  console.warn('Firebase credentials not configured - running in mock mode');
}

module.exports = { admin, db, mockMode };