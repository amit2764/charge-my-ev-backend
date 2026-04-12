const { sendOTP, verifyOTP, validatePhone, generateOTP } = require('./src/auth');

// Mock database for testing (replace with actual Firebase in production)
const mockUsers = new Map();
const mockOTPs = new Map();

// Override the auth module's database calls for testing
const originalAuth = require('./src/auth');
originalAuth.sendOTP = async (phone) => {
  try {
    if (!validatePhone(phone)) {
      return { success: false, error: 'Invalid phone number format' };
    }

    // Mock user creation
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
    return { success: true, message: 'OTP sent successfully' };

  } catch (error) {
    return { success: false, error: 'Failed to send OTP' };
  }
};

originalAuth.verifyOTP = async (phone, otp) => {
  try {
    if (!validatePhone(phone)) {
      return { success: false, error: 'Invalid phone number format' };
    }

    if (!otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return { success: false, error: 'Invalid OTP format' };
    }

    const otpData = mockOTPs.get(phone);
    if (!otpData) {
      return { success: false, error: 'OTP not found or expired' };
    }

    if (otpData.expiresAt < new Date()) {
      mockOTPs.delete(phone);
      return { success: false, error: 'OTP has expired' };
    }

    if (otpData.attempts >= 3) {
      mockOTPs.delete(phone);
      return { success: false, error: 'Too many failed attempts' };
    }

    if (otpData.otp === otp) {
      const user = mockUsers.get(phone);
      if (user) {
        user.verified = true;
      }
      mockOTPs.delete(phone);
      return { success: true, message: 'Phone number verified successfully' };
    } else {
      otpData.attempts++;
      return { success: false, error: 'Invalid OTP' };
    }

  } catch (error) {
    return { success: false, error: 'Failed to verify OTP' };
  }
};

// Test the authentication system
async function testAuthSystem() {
  console.log('=== Phone Authentication System Test ===\n');

  const testPhone = '+1234567890';

  // Test 1: Send OTP
  console.log('Test 1: Sending OTP...');
  const sendResult = await originalAuth.sendOTP(testPhone);
  console.log('Send OTP Result:', sendResult);

  // Get the OTP from mock storage for testing
  const otpData = mockOTPs.get(testPhone);
  const testOTP = otpData ? otpData.otp : '123456';

  console.log('\nTest 2: Verifying correct OTP...');
  const verifyResult = await originalAuth.verifyOTP(testPhone, testOTP);
  console.log('Verify OTP Result:', verifyResult);

  console.log('\nTest 3: Verifying wrong OTP...');
  const wrongVerifyResult = await originalAuth.verifyOTP(testPhone, '000000');
  console.log('Wrong OTP Result:', wrongVerifyResult);

  console.log('\nTest 4: Invalid phone validation...');
  console.log('Valid phone +1234567890:', validatePhone('+1234567890'));
  console.log('Invalid phone 123:', validatePhone('123'));
  console.log('Invalid phone abc:', validatePhone('abc'));

  console.log('\n=== Test Complete ===');
}

// Run the test
testAuthSystem().catch(console.error);