const { generateOTP, validateOTP } = require('./src/otp');
const { mockMode } = require('./src/config/firebase');

// Test OTP generation and validation
async function testOTP() {
  console.log('Testing OTP generation and validation...');

  // Generate OTP
  const otp = await generateOTP();
  console.log('Generated OTP:', otp);
  console.log('OTP length:', otp.length);

  // Validate OTP (should be valid)
  const result1 = await validateOTP(otp);
  console.log('First validation:', result1);

  // Validate again (should be invalid - one-time use)
  const result2 = await validateOTP(otp);
  console.log('Second validation (should fail):', result2);

  // Validate invalid OTP
  const result3 = await validateOTP('9999');
  console.log('Invalid OTP validation:', result3);

  // Test expiration
  console.log('Testing expiration...');
  const otp2 = await generateOTP();
  console.log('Generated second OTP:', otp2);

  if (mockMode) {
    // Manually expire the OTP by setting createdAt to 3 minutes ago
    const { mockOtps } = require('./src/otp');
    const otpData = mockOtps.get(otp2);
    if (otpData) {
      otpData.createdAt = new Date(Date.now() - 3 * 60 * 1000); // 3 minutes ago
      mockOtps.set(otp2, otpData);
    }
  }

  // This should fail due to expiration
  const result4 = await validateOTP(otp2);
  console.log('Validation after expiration:', result4);

  console.log('OTP tests completed.');
}

// Run tests
testOTP().catch(console.error);