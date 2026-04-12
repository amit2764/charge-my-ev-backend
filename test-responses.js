const { createHostResponse, getResponsesForRequest } = require('./src/responses');

// Test the host response system
async function testResponseSystem() {
  console.log('=== Host Response System Test ===\n');

  const testRequestId = 'req_test_123';
  const testHostId1 = 'host123';
  const testHostId2 = 'host456';

  // Test 1: Create first host response
  console.log('Test 1: Creating first host response...');
  const response1 = await createHostResponse(testRequestId, testHostId1, {
    status: 'ACCEPTED',
    message: 'Happy to provide charging at my downtown location!',
    estimatedArrival: 15,
    price: 2.50
  });
  console.log('Response 1 Result:', response1.success ? 'SUCCESS' : 'FAILED');
  if (response1.success) {
    console.log('Response ID:', response1.response.id);
    console.log('Status:', response1.response.status);
    console.log('Message:', response1.response.message);
    console.log('Price: $' + response1.response.price + '/hr');
    console.log('ETA:', response1.response.estimatedArrival + ' minutes');
  }

  // Test 2: Create second host response
  console.log('\nTest 2: Creating second host response...');
  const response2 = await createHostResponse(testRequestId, testHostId2, {
    status: 'PENDING',
    message: 'Checking availability at my residential charger',
    estimatedArrival: 30,
    price: 1.75
  });
  console.log('Response 2 Result:', response2.success ? 'SUCCESS' : 'FAILED');

  // Test 3: Try to create duplicate response (should fail)
  console.log('\nTest 3: Attempting duplicate response (should fail)...');
  const duplicateResponse = await createHostResponse(testRequestId, testHostId1, {
    status: 'DECLINED'
  });
  console.log('Duplicate Response Result:', duplicateResponse.success ? 'UNEXPECTED SUCCESS' : 'EXPECTED FAILURE');
  console.log('Error:', duplicateResponse.error);

  // Test 4: Get all responses for the request
  console.log('\nTest 4: Getting all responses for request...');
  const allResponses = await getResponsesForRequest(testRequestId);
  console.log('Found', allResponses.count, 'responses');
  allResponses.responses.forEach((response, index) => {
    console.log(`  ${index + 1}. Host ${response.hostId}: ${response.status} - $${response.price}/hr`);
  });

  // Test 5: Validation tests
  console.log('\nTest 5: Validation tests...');

  // Invalid requestId
  const invalidRequest = await createHostResponse('', testHostId1);
  console.log('Empty requestId:', invalidRequest.success ? 'FAIL' : 'PASS');

  // Invalid hostId
  const invalidHost = await createHostResponse(testRequestId, '');
  console.log('Empty hostId:', invalidHost.success ? 'FAIL' : 'PASS');

  // Invalid status
  const invalidStatus = await createHostResponse('req_new', 'host_new', { status: 'INVALID' });
  console.log('Invalid status:', invalidStatus.success ? 'FAIL' : 'PASS');

  // Negative price
  const negativePrice = await createHostResponse('req_new2', 'host_new2', { price: -5 });
  console.log('Negative price:', negativePrice.success ? 'FAIL' : 'PASS');

  // Test 6: Get responses for non-existent request
  console.log('\nTest 6: Getting responses for non-existent request...');
  const noResponses = await getResponsesForRequest('nonexistent');
  console.log('Non-existent request responses:', noResponses.count);

  // Test 7: Different response types
  console.log('\nTest 7: Testing different response types...');

  // DECLINED response
  const declinedResponse = await createHostResponse('req_declined', 'host_declined', {
    status: 'DECLINED',
    message: 'Sorry, charger is currently occupied'
  });
  console.log('Declined response:', declinedResponse.success ? 'SUCCESS' : 'FAILED');

  // PENDING response with minimal data
  const pendingResponse = await createHostResponse('req_pending', 'host_pending', {
    status: 'PENDING'
  });
  console.log('Pending response:', pendingResponse.success ? 'SUCCESS' : 'FAILED');

  console.log('\n=== Test Complete ===');

  // Explain the code line-by-line
  console.log('\n=== Line-by-Line Code Explanation ===');
  console.log(`
createHostResponse Function:
1. Validates required inputs (requestId, hostId)
2. Checks for duplicate responses using validateUniqueResponse
3. Validates optional parameters (status, estimatedArrival, price)
4. Creates response object with timestamps
5. Stores in Firestore or mock storage
6. Returns success/error response

getResponsesForRequest Function:
1. Validates requestId parameter
2. Queries Firestore for all responses to that request
3. Orders results by timestamp (newest first)
4. Formats response data with proper timestamps
5. Returns array of responses

Validation Logic:
- Duplicate Prevention: Checks if host already responded to request
- Status Validation: Only ACCEPTED, DECLINED, PENDING allowed
- Price Validation: Must be positive number
- Time Validation: Estimated arrival must be positive minutes
- Input Sanitization: Trims strings, converts to uppercase where needed

Error Handling:
- Comprehensive input validation
- Database error catching
- Meaningful error messages
- Graceful degradation in mock mode
  `);
}

// Run the test
testResponseSystem().catch(console.error);