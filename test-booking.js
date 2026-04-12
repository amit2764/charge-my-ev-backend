const { createBooking, startCharging, stopCharging } = require('./src/booking');

// Test createBooking function
async function testCreateBooking() {
  console.log('Testing createBooking...');

  // Test valid booking
  const result1 = await createBooking('user123', 'host456', 'charger789', 25.50);
  console.log('Valid booking result:', result1);

  // Test missing userId
  const result2 = await createBooking('', 'host456', 'charger789', 25.50);
  console.log('Missing userId result:', result2);

  // Test invalid price
  const result3 = await createBooking('user123', 'host456', 'charger789', -10);
  console.log('Invalid price result:', result3);

  // Test missing price
  const result4 = await createBooking('user123', 'host456', 'charger789');
  console.log('Missing price result:', result4);
}

// Test startCharging function
async function testStartCharging() {
  console.log('Testing startCharging...');

  // Test 1: Valid start charging
  const booking1 = await createBooking('user123', 'host456', 'charger789', 25.50);
  if (booking1.success) {
    const result1 = await startCharging(booking1.booking.id, booking1.booking.startOtp);
    console.log('Valid start charging result:', result1);
  }

  // Test 2: Invalid OTP
  const booking2 = await createBooking('user123', 'host456', 'charger789', 25.50);
  if (booking2.success) {
    const result2 = await startCharging(booking2.booking.id, '999999');
    console.log('Invalid OTP result:', result2);
  }

  // Test 3: Non-existent booking
  const result3 = await startCharging('nonexistent', '123456');
  console.log('Non-existent booking result:', result3);

  // Test 4: Starting already started booking
  const booking4 = await createBooking('user123', 'host456', 'charger789', 25.50);
  if (booking4.success) {
    await startCharging(booking4.booking.id, booking4.booking.startOtp); // Start it first
    const result4 = await startCharging(booking4.booking.id, booking4.booking.startOtp); // Try again
    console.log('Starting already started booking:', result4);
  }

  // Test 5: Missing inputs
  const result5 = await startCharging('', '123456');
  console.log('Missing bookingId result:', result5);

  const booking6 = await createBooking('user123', 'host456', 'charger789', 25.50);
  if (booking6.success) {
    const result6 = await startCharging(booking6.booking.id, '');
    console.log('Missing otp result:', result6);
  }
}

// Test stopCharging function
async function testStopCharging() {
  console.log('Testing stopCharging...');

  // Helper function to add delay
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Test 1: Valid stop charging
  const booking1 = await createBooking('user123', 'host456', 'charger789', 25.50);
  if (booking1.success) {
    await startCharging(booking1.booking.id, booking1.booking.startOtp);
    await delay(100); // Wait 100ms to create measurable duration
    const result1 = await stopCharging(booking1.booking.id, booking1.booking.endOtp);
    console.log('Valid stop charging result:', result1);
  }

  // Test 2: Invalid OTP
  const booking2 = await createBooking('user123', 'host456', 'charger789', 25.50);
  if (booking2.success) {
    await startCharging(booking2.booking.id, booking2.booking.startOtp);
    await delay(100);
    const result2 = await stopCharging(booking2.booking.id, '999999');
    console.log('Invalid stop OTP result:', result2);
  }

  // Test 3: Non-existent booking
  const result3 = await stopCharging('nonexistent', '123456');
  console.log('Stop non-existent booking result:', result3);

  // Test 4: Stopping a BOOKED booking (not started)
  const booking4 = await createBooking('user123', 'host456', 'charger789', 25.50);
  if (booking4.success) {
    const result4 = await stopCharging(booking4.booking.id, booking4.booking.endOtp);
    console.log('Stopping BOOKED booking result:', result4);
  }

  // Test 5: Missing inputs
  const result5 = await stopCharging('', '123456');
  console.log('Missing bookingId result:', result5);

  const booking6 = await createBooking('user123', 'host456', 'charger789', 25.50);
  if (booking6.success) {
    await startCharging(booking6.booking.id, booking6.booking.startOtp);
    await delay(100);
    const result6 = await stopCharging(booking6.booking.id, '');
    console.log('Missing otp result:', result6);
  }

  // Test 6: Duration and final amount calculation with billing
  console.log('\nTesting duration and amount calculation with billing...');
  const booking7 = await createBooking('user123', 'host456', 'charger789', 50); // $50/hour
  if (booking7.success) {
    await startCharging(booking7.booking.id, booking7.booking.startOtp);
    await delay(500); // Wait 500ms to create measurable duration
    const result7 = await stopCharging(booking7.booking.id, booking7.booking.endOtp);
    console.log('Duration and final amount:', {
      durationMinutes: result7.durationMinutes,
      roundedDurationMinutes: result7.roundedDurationMinutes,
      finalAmount: result7.finalAmount,
      hourlyRate: 50,
      billingDetails: result7.billing
    });
  }
}

// Run tests
testCreateBooking().then(() => {
  return testStartCharging();
}).then(() => {
  return testStopCharging();
}).then(() => {
  console.log('Booking tests completed.');
}).catch(console.error);