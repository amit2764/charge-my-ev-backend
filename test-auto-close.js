const {
  startAutoCloseJob,
  stopAutoCloseJob,
  getAutoCloseStatus,
  runAutoCloseCheck,
  getBookedBookings,
  hasExceededWaitTime,
  getElapsedMinutes,
  setMockBookings,
  CONFIG
} = require('./src/auto-close');
const { mockMode } = require('./src/config/firebase');

// Comprehensive Auto-Close Logic Tests
async function testAutoCloseLogic() {
  console.log('=== AUTO-CLOSE LOGIC COMPREHENSIVE TEST ===\n');

  // Test 1: Check configuration
  console.log('TEST 1: Configuration Validation');
  console.log('─'.repeat(50));
  console.log(`Max booking wait time: ${CONFIG.MAX_BOOKING_WAIT_MS / 1000 / 60} minutes`);
  console.log(`Check interval: ${CONFIG.CHECK_INTERVAL_MS / 1000 / 60} minutes`);
  console.log(`✓ Configuration loaded\n`);

  // Test 2: hasExceededWaitTime function
  console.log('TEST 2: Wait Time Check Logic');
  console.log('─'.repeat(50));

  const testCases = [
    { minutes: 5, expected: false, desc: '5 minutes old' },
    { minutes: 15, expected: false, desc: '15 minutes old' },
    { minutes: 29.9, expected: false, desc: '29.9 minutes old' },
    { minutes: 30, expected: true, desc: '30 minutes old (exact)' },
    { minutes: 35, expected: true, desc: '35 minutes old' },
    { minutes: 60, expected: true, desc: '60 minutes old' },
  ];

  for (const test of testCases) {
    const createdAt = new Date(Date.now() - test.minutes * 60 * 1000);
    const exceeded = hasExceededWaitTime(createdAt);
    const result = exceeded === test.expected ? '✓' : '✗';
    console.log(`  ${result} ${test.desc}: exceeded=${exceeded}`);
  }
  console.log();

  // Test 3: Elapsed minutes calculation
  console.log('TEST 3: Elapsed Minutes Calculation');
  console.log('─'.repeat(50));

  const durations = [1, 5, 10, 15, 25, 30, 45, 60];
  for (const mins of durations) {
    const createdAt = new Date(Date.now() - mins * 60 * 1000);
    const elapsed = getElapsedMinutes(createdAt);
    console.log(`  Age: ${mins}min → Elapsed: ${elapsed.toFixed(1)}min`);
  }
  console.log();

  // Test 4: Auto-close job status  
  console.log('TEST 4: Auto-Close Job Status');
  console.log('─'.repeat(50));

  let status = getAutoCloseStatus();
  console.log(`  Before start: isRunning=${status.isRunning}`);

  const startResult = startAutoCloseJob();
  console.log(`  Start result: status=${startResult.status}`);

  status = getAutoCloseStatus();
  console.log(`  After start: isRunning=${status.isRunning}`);

  const stopResult = stopAutoCloseJob();
  console.log(`  Stop result: status=${stopResult.status}`);

  status = getAutoCloseStatus();
  console.log(`  After stop: isRunning=${status.isRunning}`);
  console.log();

  // Test 5: Manual auto-close check with booked bookings
  console.log('TEST 5: Manual Auto-Close Check');
  console.log('─'.repeat(50));

  if (mockMode) {
    console.log('Note: This test demonstrates early-stage auto-close detection.');
    console.log('Bookings exceeding 30 minutes are marked as EXPIRED.\n');

    // Create mock bookings
    const mockBookings = new Map();
    const now = new Date();

    // Booking 1: Recent (should NOT be closed)
    const recent = new Date(now.getTime() - 5 * 60 * 1000); // 5 min ago
    const bookingRecentId = 'booking_recent';
    mockBookings.set(bookingRecentId, {
      id: bookingRecentId,
      userId: 'user1',
      hostId: 'host1',
      chargerId: 'charger1',
      status: 'BOOKED',
      price: 50,
      startOtp: '123456',
      endOtp: '654321',
      createdAt: recent
    });

    // Booking 2: Mid-wait (should NOT be closed)
    const midWait = new Date(now.getTime() - 20 * 60 * 1000); // 20 min ago
    const bookingMidId = 'booking_midwait';
    mockBookings.set(bookingMidId, {
      id: bookingMidId,
      userId: 'user2',
      hostId: 'host2',
      chargerId: 'charger2',
      status: 'BOOKED',
      price: 75,
      startOtp: '111111',
      endOtp: '222222',
      createdAt: midWait
    });

    // Booking 3: Expired (WILL be closed)
    const expired = new Date(now.getTime() - 45 * 60 * 1000); // 45 min ago
    const bookingExpiredId = 'booking_expired';
    mockBookings.set(bookingExpiredId, {
      id: bookingExpiredId,
      userId: 'user3',
      hostId: 'host3',
      chargerId: 'charger3',
      status: 'BOOKED',
      price: 100,
      startOtp: '333333',
      endOtp: '444444',
      createdAt: expired
    });

    // Set mock bookings
    setMockBookings(mockBookings);

    console.log('Created mock bookings:');
    console.log('  - booking_recent: 5 minutes (should NOT close)');
    console.log('  - booking_midwait: 20 minutes (should NOT close)');
    console.log('  - booking_expired: 45 minutes (WILL close)');

    // Run check
    const checkResult = await runAutoCloseCheck();
    console.log(`\nAuto-close detection results:`);
    console.log(`  Bookings checked: ${checkResult.bookingsChecked}`);
    console.log(`  Bookings closed: ${checkResult.bookingsClosed}`);

    if (checkResult.results && checkResult.results.length > 0) {
      console.log(`\nClosed bookings:`);
      for (const result of checkResult.results) {
        if (result.success) {
          console.log(`  ✓ ${result.bookingId}: ${result.action} (${result.elapsedMinutes.toFixed(1)}min)`);
        }
      }
    }
  } else {
    console.log('  (Skipped - requires mock mode)');
  }
  console.log();

  // Test 6: Job lifecycle
  console.log('TEST 6: Auto-Close Job Lifecycle');
  console.log('─'.repeat(50));

  console.log('  Starting job...');
  const start = startAutoCloseJob();
  console.log(`  ✓ Started: ${start.status}`);

  console.log('  Getting status...');
  const statusAfterStart = getAutoCloseStatus();
  console.log(`  ✓ Status: isRunning=${statusAfterStart.isRunning}`);

  console.log('  Stopping job...');
  const stop = stopAutoCloseJob();
  console.log(`  ✓ Stopped: ${stop.status}`);

  const statusAfterStop = getAutoCloseStatus();
  console.log(`  ✓ Status: isRunning=${statusAfterStop.isRunning}`);
  console.log();

  // Test 7: Double start/stop handling
  console.log('TEST 7: Error Handling (Double Start/Stop)');
  console.log('─'.repeat(50));

  const firstStart = startAutoCloseJob();
  console.log(`  First start: ${firstStart.status}`);

  const secondStart = startAutoCloseJob();
  console.log(`  Second start: ${secondStart.status} (should be 'already-running')`);

  const firstStop = stopAutoCloseJob();
  console.log(`  First stop: ${firstStop.status}`);

  const secondStop = stopAutoCloseJob();
  console.log(`  Second stop: ${secondStop.status} (should be 'not-running')`);
  console.log();

  // Test 8: Timeout scenarios
  console.log('TEST 8: Timeout Boundary Testing');
  console.log('─'.repeat(50));

  const boundaries = [
    { minutes: 29.99, expectClose: false },
    { minutes: 30.00, expectClose: true },
    { minutes: 30.01, expectClose: true },
  ];

  for (const boundary of boundaries) {
    const createdAt = new Date(Date.now() - boundary.minutes * 60 * 1000);
    const shouldClose = hasExceededWaitTime(createdAt);
    const result = shouldClose === boundary.expectClose ? '✓' : '✗';
    console.log(`  ${result} ${boundary.minutes.toFixed(2)}min: shouldClose=${shouldClose}`);
  }
  console.log();

  console.log('='.repeat(50));
  console.log('Auto-Close Logic Tests Complete!');
  console.log('='.repeat(50));
}

// Run tests
testAutoCloseLogic().catch(console.error);
