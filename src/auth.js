const { db } = require('./config/firebase');
const admin = require('firebase-admin');
const axios = require('axios'); // Ensure axios is in your package.json

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
  // Basic phone validation: 10-15 digits, may start with +
  const phoneRegex = /^\+?[1-9]\d{9,14}$/;
  const isValid = phoneRegex.test(phone);
  console.log(`Validating phone ${phone}: ${isValid}`);
  return isValid;
}

/**
 * Helper to dispatch SMS via Fast2SMS
 */
async function sendSmsViaFast2SMS(phone, otp) {
  const smsApiKey = process.env.SMS_API_KEY || 'ilx3esPUayHkBRj9pcvq26ZmSCowEdXVgKtFNWAO0rIJMnGL7zoLZaAOuepzyKUqTmYjNRw70bHEWD4g';
  if (!smsApiKey) return;
  
  try {
    const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: smsApiKey,
        variables_values: otp,
        route: 'otp',
        numbers: phone.replace(/\D/g, '').slice(-10)
      }
    });
    
    if (!response.data.return) {
      console.warn('SMS Gateway warning:', response.data.message);
    } else {
      console.log(`[PROD] SMS actually sent to ${phone}`); 
    }
  } catch (smsError) {
    console.error('Failed to send SMS via provider:', smsError.response?.data || smsError.message);
  }
}

/**
 * Sends OTP to phone number (mock implementation - no SMS API)
 * @param {string} phone - Phone number
 * @returns {Promise<Object>} Success/error response
 */
async function sendOTP(phone) {
  try {
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
      
      // Always try to send SMS
      await sendSmsViaFast2SMS(phone, otp);

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
        // OTP correct - mark user as verified and delete OTP
        await db.collection('users').doc(phone).update({
          verified: true
        });

        await otpRef.delete();

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
        if (user) {
          user.verified = true;
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

module.exports = {
  sendOTP,
  verifyOTP,
  validatePhone,
  generateOTP,
  getUser,
  isUserVerified
};