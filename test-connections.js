require('dotenv').config();
const { db, mockMode } = require('./src/config/firebase');
const redis = require('./src/lib/redis');

async function runTests() {
  console.log('🔍 RUNNING SYSTEM CONNECTION TESTS...\n');
  let allPassed = true;

  // 1. Test Firebase
  console.log('Testing Firebase Connection...');
  if (mockMode) {
    console.log('❌ FAILED: Firebase is running in MOCK mode. Check your FIREBASE_* credentials in .env.');
    allPassed = false;
  } else {
    try {
      // Try to write a temporary ping document
      await db.collection('system_test').doc('ping').set({ timestamp: new Date() });
      console.log('✅ PASSED: Successfully connected and wrote to Firestore!');
    } catch (err) {
      console.log(`❌ FAILED: Could not write to Firestore. Error: ${err.message}`);
      allPassed = false;
    }
  }
  console.log('----------------------------------------');

  // 2. Test Redis
  console.log('Testing Redis Connection...');
  if (!redis) {
    console.log('❌ FAILED: Redis is not configured. Check REDIS_URL in .env.');
    allPassed = false;
  } else {
    try {
      const ping = await redis.ping();
      if (ping === 'PONG') {
        console.log('✅ PASSED: Successfully connected to Redis Server!');
      } else {
        console.log(`❌ FAILED: Unexpected Redis response: ${ping}`);
        allPassed = false;
      }
    } catch (err) {
      console.log(`❌ FAILED: Could not connect to Redis. Error: ${err.message}`);
      allPassed = false;
    }
  }
  console.log('----------------------------------------');

  if (allPassed) {
    console.log('🎉 ALL SYSTEMS GO! Your backend is fully connected and ready for production.');
  } else {
    console.log('⚠️ SOME TESTS FAILED. Please fix the errors above before launching.');
  }

  // Clean exit
  setTimeout(() => process.exit(allPassed ? 0 : 1), 1000);
}

runTests();