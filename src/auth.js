const { db } = require('./config/firebase');
const admin = require('firebase-admin');
const axios = require('axios'); // Ensure axios is in your package.json
const { sendEmail } = require('./email');

/**
 * Firestore Schema:
 * - users collection:
 *   - phone: string (unique identifier)
 *   - createdAt: timestamp
 *   - verified: boolean (true if phone verified)
 *
 * - otps collection:
 *   - phone: string
 *   - otp: string (6-digit code)
 *   - expiresAt: timestamp (OTP expires in 5 minutes)
 *   - attempts: number (failed verification attempts, max 3)
 */

// Mock storage for when Firebase is not configured
const mockUsers = new Map();
const mockOTPs = new Map();

/**
 * Generates a random 6-digit OTP
 * @returns {string} 6-digit OTP
 */
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Validates phone number format (basic validation)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid format
 */
function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const normalizedPhone = phone.trim().replace(/\s+/g, '');
  const phoneRegex = /^\+?[1-9]\d{9,14}$/;
  const isValid = phoneRegex.test(normalizedPhone);
  console.log(`Validating phone "${phone}" => "${normalizedPhone}": ${isValid}`);
  return isValid;
}

/**
 * Helper to dispatch SMS via Firebase Phone Authentication
 * Note: Firebase Phone Auth is typically client-side. For server-side OTP,
 * consider using Firebase Cloud Functions or a different SMS provider.
 */
async function sendSmsViaFirebase(phone, otp) {
  // Firebase Admin SDK doesn't send SMS directly - that's client-side
  // For production, implement Firebase Phone Auth in the frontend
  console.log(`[FIREBASE MOCK] Firebase Phone Auth not implemented server-side. OTP for ${phone} is: ${otp}`);
  console.log(`[INFO] Implement Firebase Phone Authentication in frontend for real SMS delivery`);
  return;
}

/**
 * Sends OTP to phone number (mock implementation - no SMS API)
 * @param {string} phone - Phone number
 * @returns {Promise<Object>} Success/error response
 */
async function sendOTP(phone) {
  try {
    phone = typeof phone === 'string' ? phone.trim().replace(/\s+/g, '') : phone;

    // Validate phone number
    if (!validatePhone(phone)) {
      return {
        success: false,
        error: 'Invalid phone number format'
      };
    }

    if (db) {
      // Firebase mode
      // Check if user exists, if not create them
      const userRef = db.collection('users').doc(phone);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        // Create new user
        await userRef.set({
          phone: phone,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          verified: false
        });
      }

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 5 * 60 * 1000) // 5 minutes from now
      );

      // Store OTP in Firestore
      await db.collection('otps').doc(phone).set({
        phone: phone,
        otp: otp,
        expiresAt: expiresAt,
        attempts: 0
      });

      console.log(`[DEV] Generated OTP for ${phone}: ${otp}`);
      
      // Attempt to send real SMS via Firebase (currently mock)
      await sendSmsViaFirebase(phone, otp);

      return {
        success: true,
        message: 'OTP sent successfully',
      };
    } else {
      // Mock mode
      if (!mockUsers.has(phone)) {
        mockUsers.set(phone, {
          phone,
          createdAt: new Date(),
          verified: false
        });
      }

      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      mockOTPs.set(phone, {
        phone,
        otp,
        expiresAt,
        attempts: 0
      });

      console.log(`MOCK OTP for ${phone}: ${otp}`);
      
      // Attempt to send real SMS via Firebase even in mock mode
      await sendSmsViaFirebase(phone, otp);

      return {
        success: true,
        message: 'OTP sent successfully (mock mode)',
        otp: otp // Include OTP in response for simulation/testing
      };
    }

  } catch (error) {
    console.error('Error sending OTP:', error);
    return {
      success: false,
      error: 'Failed to send OTP'
    };
  }
}

/**
 * Verifies OTP for phone number
 * @param {string} phone - Phone number
 * @param {string} otp - OTP to verify
 * @returns {Promise<Object>} Success/error response
 */
async function verifyOTP(phone, otp) {
  try {
    phone = typeof phone === 'string' ? phone.trim().replace(/\s+/g, '') : phone;

    // Validate inputs
    if (!validatePhone(phone)) {
      return {
        success: false,
        error: 'Invalid phone number format'
      };
    }

    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return {
        success: false,
        error: 'Invalid OTP format'
      };
    }

    if (db) {
      // Firebase mode
      // Get OTP document
      const otpRef = db.collection('otps').doc(phone);
      const otpDoc = await otpRef.get();

      if (!otpDoc.exists) {
        return {
          success: false,
          error: 'OTP not found or expired'
        };
      }

      const otpData = otpDoc.data();

      // Check if OTP has expired
      if (otpData.expiresAt.toDate() < new Date()) {
        // Delete expired OTP
        await otpRef.delete();
        return {
          success: false,
          error: 'OTP has expired'
        };
      }

      // Check attempts (max 3)
      if (otpData.attempts >= 3) {
        await otpRef.delete();
        return {
          success: false,
          error: 'Too many failed attempts'
        };
      }

      // Verify OTP
      if (otpData.otp === otp) {
        const userRef = db.collection('users').doc(phone);
        const userDoc = await userRef.get();
        const isFirstVerification = userDoc.exists && !userDoc.data().verified;

        // OTP correct - mark user as verified and delete OTP
        await userRef.update({
          verified: true
        });

        await otpRef.delete();

        // If this is the first time they are verifying, send a welcome email.
        // NOTE: This assumes a placeholder email. In a real app, you'd collect the user's email.
        if (isFirstVerification) {
          sendEmail(phone + '@example.com', 'Welcome to EV P2P Charging!', 'Your account is now verified.', '<h1>Welcome!</h1><p>Your account is now verified and ready to use.</p>');
        }

        return {
          success: true,
          message: 'Phone number verified successfully'
        };
      } else {
        // OTP incorrect - increment attempts
        await otpRef.update({
          attempts: admin.firestore.FieldValue.increment(1)
        });

        return {
          success: false,
          error: 'Invalid OTP'
        };
      }
    } else {
      // Mock mode
      const otpData = mockOTPs.get(phone);
      if (!otpData) {
        return {
          success: false,
          error: 'OTP not found or expired'
        };
      }

      if (otpData.expiresAt < new Date()) {
        mockOTPs.delete(phone);
        return {
          success: false,
          error: 'OTP has expired'
        };
      }

      if (otpData.attempts >= 3) {
        mockOTPs.delete(phone);
        return {
          success: false,
          error: 'Too many failed attempts'
        };
      }

      if (otpData.otp === otp) {
        const user = mockUsers.get(phone);
        const isFirstVerification = user && !user.verified;

        if (isFirstVerification) {
          user.verified = true;
          // Send welcome email in mock mode
          sendEmail(phone + '@example.com', 'Welcome to EV P2P Charging!', 'Your account is now verified.', '<h1>Welcome!</h1><p>Your account is now verified and ready to use.</p>');
        }

        mockOTPs.delete(phone);
        return {
          success: true,
          message: 'Phone number verified successfully (mock mode)'
        };
      } else {
        otpData.attempts++;
        return {
          success: false,
          error: 'Invalid OTP'
        };
      }
    }

  } catch (error) {
    console.error('Error verifying OTP:', error);
    return {
      success: false,
      error: 'Failed to verify OTP'
    };
  }
}

async function getUser(phone) {
  if (!validatePhone(phone)) {
    return null;
  }

  if (db) {
    const userRef = db.collection('users').doc(phone);
    const userDoc = await userRef.get();
    return userDoc.exists ? { id: userDoc.id, ...userDoc.data() } : null;
  }

  return mockUsers.get(phone) || null;
}

async function isUserVerified(phone) {
  if (!validatePhone(phone)) {
    return {
      success: false,
      error: 'Invalid phone number format'
    };
  }

  const user = await getUser(phone);
  if (!user) {
    return {
      success: false,
      error: 'User not found. Verify phone before using this feature'
    };
  }

  return {
    success: true,
    verified: !!user.verified
  };
}

async function ensureVerifiedUser(phone) {
  const result = await isUserVerified(phone);
  if (!result.success) return result;
  if (!result.verified) {
    return { success: false, error: 'User phone number must be verified to perform this action' };
  }
  return { success: true };
}

module.exports = {
  sendOTP,
  verifyOTP,
  validatePhone,
  generateOTP,
  getUser,
  isUserVerified,
  ensureVerifiedUser
};