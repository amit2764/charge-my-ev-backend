/**
 * Monitoring System Test
 * Tests the monitoring and alerting functionality
 */

const { initializeMonitoring, trackApiFailure, trackOtpError, trackBookingFailure, trackSessionIssue, getMetrics, getRecentLogs, getRecentAlerts } = require('./src/monitoring');

async function testMonitoringSystem() {
  console.log('=== MONITORING SYSTEM TEST ===\n');

  // Initialize monitoring
  console.log('1. Initializing monitoring system...');
  await initializeMonitoring();
  console.log('✅ Monitoring initialized\n');

  // Test API failure tracking
  console.log('2. Testing API failure tracking...');
  await trackApiFailure('/api/test', 'POST', 500, 'Test server error', { test: true });
  console.log('✅ API failure tracked\n');

  // Test OTP error tracking
  console.log('3. Testing OTP error tracking...');
  await trackOtpError('user123', 'session456', 'EXPIRED_OTP', 'OTP expired after 15 minutes');
  await trackOtpError('user789', 'session012', 'INVALID_OTP', 'Wrong OTP entered');
  console.log('✅ OTP errors tracked\n');

  // Test booking failure tracking
  console.log('4. Testing booking failure tracking...');
  await trackBookingFailure('user123', 'host456', 'PAYMENT_FAILED', 'Payment processing failed', { amount: 25.50 });
  await trackBookingFailure('user789', 'host012', 'VALIDATION_FAILED', 'Invalid booking data', { missing: 'chargerId' });
  console.log('✅ Booking failures tracked\n');

  // Test session issue tracking
  console.log('5. Testing session issue tracking...');
  await trackSessionIssue('booking123', 'user456', 'AUTO_STOPPED', 'Session exceeded 8 hour limit', { duration: 8 });
  await trackSessionIssue('booking789', 'user012', 'STATE_ERROR', 'Session state corrupted', { state: 'UNKNOWN' });
  console.log('✅ Session issues tracked\n');

  // Test metrics retrieval
  console.log('6. Testing metrics retrieval...');
  const metrics = getMetrics();
  console.log('Current metrics:', JSON.stringify(metrics.current, null, 2));
  console.log('Last hour metrics:', JSON.stringify(metrics.lastHour, null, 2));
  console.log('✅ Metrics retrieved\n');

  // Test logs retrieval
  console.log('7. Testing logs retrieval...');
  const logs = await getRecentLogs(10);
  console.log(`Retrieved ${logs.length} recent logs`);
  if (logs.length > 0) {
    console.log('Sample log entry:', JSON.stringify(logs[0], null, 2));
  }
  console.log('✅ Logs retrieved\n');

  // Test alerts retrieval
  console.log('8. Testing alerts retrieval...');
  const alerts = await getRecentAlerts(10);
  console.log(`Retrieved ${alerts.length} recent alerts`);
  if (alerts.length > 0) {
    console.log('Sample alert entry:', JSON.stringify(alerts[0], null, 2));
  }
  console.log('✅ Alerts retrieved\n');

  // Wait a moment for alerts to be processed
  console.log('9. Waiting for alert processing...');
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Check for alerts again
  const updatedAlerts = await getRecentAlerts(10);
  console.log(`After processing: ${updatedAlerts.length} alerts`);
  if (updatedAlerts.length > 0) {
    console.log('Alert details:');
    updatedAlerts.forEach((alert, index) => {
      console.log(`  ${index + 1}. [${alert.level}] ${alert.message}`);
    });
  }
  console.log('✅ Alert processing complete\n');

  console.log('=== MONITORING SYSTEM TEST COMPLETE ===');
  console.log('\n📊 Summary:');
  console.log(`   - API Failures: ${metrics.current.apiFailures}`);
  console.log(`   - OTP Errors: ${metrics.current.otpErrors}`);
  console.log(`   - Booking Failures: ${metrics.current.bookingFailures}`);
  console.log(`   - Session Issues: ${metrics.current.sessionIssues}`);
  console.log(`   - Total Logs: ${logs.length}`);
  console.log(`   - Total Alerts: ${updatedAlerts.length}`);
}

// Run the test
testMonitoringSystem().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});