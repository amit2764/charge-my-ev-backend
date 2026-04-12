const { db, mockMode } = require('./config/firebase');

// Mock storage for OTPs in development
let mockOtps = new Map();

// Generate a 4-digit OTP
function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Store OTP with expiration and one-time use tracking
async function storeOTP(otp) {
  const createdAt = new Date();

  if (mockMode) {
    mockOtps.set(otp, { createdAt, used: false });
  } else {
    await db.collection('otps').doc(otp).set({
      createdAt,
      used: false
    });
  }
}

// Validate OTP: check existence, expiration (2 minutes), and one-time use
async function validateOTP(otp) {
  try {
    let otpData = null;

    if (mockMode) {
      otpData = mockOtps.get(otp);
    } else {
      const otpDoc = await db.collection('otps').doc(otp).get();
      if (otpDoc.exists) {
        otpData = otpDoc.data();
      }
    }

    if (!otpData) {
      return { valid: false, error: 'OTP not found' };
    }

    // Check if already used
    if (otpData.used) {
      return { valid: false, error: 'OTP already used' };
    }

    // Check expiration (2 minutes)
    const now = new Date();
    const createdAt = otpData.createdAt.toDate ? otpData.createdAt.toDate() : new Date(otpData.createdAt);
    const diffMinutes = (now - createdAt) / (1000 * 60);

    if (diffMinutes > 2) {
      return { valid: false, error: 'OTP expired' };
    }

    // Mark as used
    if (mockMode) {
      otpData.used = true;
      mockOtps.set(otp, otpData);
    } else {
      await db.collection('otps').doc(otp).update({ used: true });
    }

    return { valid: true };
  } catch (error) {
    console.error('Error validating OTP:', error);
    return { valid: false, error: 'Validation failed' };
  }
}

// Generate and store a new OTP
async function generateAndStoreOTP() {
  const otp = generateOTP();
  await storeOTP(otp);
  return otp;
}

module.exports = {
  generateOTP: generateAndStoreOTP,
  validateOTP
};

// Export mockOtps for testing in development
if (mockMode) {
  module.exports.mockOtps = mockOtps;
}