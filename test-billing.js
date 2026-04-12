const { calculateBillingAmount } = require('./src/billing');

// Test calculateBillingAmount function
async function testBillingCalculation() {
  console.log('Testing Billing Calculation Logic...\n');

  // Test 1: Basic calculation - 15 minutes at $50/hour
  console.log('Test 1: 15 minutes at $50/hour');
  const startTime1 = new Date('2026-04-12T10:00:00Z');
  const endTime1 = new Date('2026-04-12T10:15:00Z');
  const result1 = calculateBillingAmount(startTime1, endTime1, 50);
  console.log('Result:', result1);
  console.log('Expected: 15 min → rounded to 20 min → $16.67\n');

  // Test 2: Exact 10 minutes - should not round up further
  console.log('Test 2: 10 minutes at $50/hour');
  const startTime2 = new Date('2026-04-12T10:00:00Z');
  const endTime2 = new Date('2026-04-12T10:10:00Z');
  const result2 = calculateBillingAmount(startTime2, endTime2, 50);
  console.log('Result:', result2);
  console.log('Expected: 10 min → already at 10 min boundary → $8.33\n');

  // Test 3: 1 minute - rounds up to 10 minutes
  console.log('Test 3: 1 minute at $50/hour');
  const startTime3 = new Date('2026-04-12T10:00:00Z');
  const endTime3 = new Date('2026-04-12T10:01:00Z');
  const result3 = calculateBillingAmount(startTime3, endTime3, 50);
  console.log('Result:', result3);
  console.log('Expected: 1 min → rounded to 10 min → $8.33\n');

  // Test 4: 35 minutes - rounds up to 40 minutes
  console.log('Test 4: 35 minutes at $30/hour');
  const startTime4 = new Date('2026-04-12T10:00:00Z');
  const endTime4 = new Date('2026-04-12T10:35:00Z');
  const result4 = calculateBillingAmount(startTime4, endTime4, 30);
  console.log('Result:', result4);
  console.log('Expected: 35 min → rounded to 40 min → $20.00\n');

  // Test 5: With buffer - 15 minutes + 5 minute buffer = 20 minutes
  console.log('Test 5: 15 minutes at $50/hour with 5 minute buffer');
  const startTime5 = new Date('2026-04-12T10:00:00Z');
  const endTime5 = new Date('2026-04-12T10:15:00Z');
  const result5 = calculateBillingAmount(startTime5, endTime5, 50, 5);
  console.log('Result:', result5);
  console.log('Expected: 15 min + 5 min buffer = 20 min (at boundary) → $16.67\n');

  // Test 6: 60 minutes (1 hour) - should remain at 60 minutes
  console.log('Test 6: 60 minutes (1 hour) at $50/hour');
  const startTime6 = new Date('2026-04-12T10:00:00Z');
  const endTime6 = new Date('2026-04-12T11:00:00Z');
  const result6 = calculateBillingAmount(startTime6, endTime6, 50);
  console.log('Result:', result6);
  console.log('Expected: 60 min → already at boundary → $50.00\n');

  // Test 7: 2.5 hours (150 minutes) - should remain at 150 minutes
  console.log('Test 7: 2.5 hours (150 minutes) at $40/hour');
  const startTime7 = new Date('2026-04-12T10:00:00Z');
  const endTime7 = new Date('2026-04-12T12:30:00Z');
  const result7 = calculateBillingAmount(startTime7, endTime7, 40);
  console.log('Result:', result7);
  console.log('Expected: 150 min → already at boundary → $100.00\n');

  // Test 8: Invalid inputs
  console.log('Test 8: Missing endTime');
  const result8 = calculateBillingAmount(new Date(), undefined, 50);
  console.log('Result:', result8);
  console.log('Expected: Error message\n');

  // Test 9: Negative price
  console.log('Test 9: Negative price');
  const result9 = calculateBillingAmount(new Date('2026-04-12T10:00:00Z'), new Date('2026-04-12T10:15:00Z'), -50);
  console.log('Result:', result9);
  console.log('Expected: Error message\n');

  // Test 10: endTime before startTime
  console.log('Test 10: endTime before startTime');
  const result10 = calculateBillingAmount(new Date('2026-04-12T10:15:00Z'), new Date('2026-04-12T10:00:00Z'), 50);
  console.log('Result:', result10);
  console.log('Expected: Error message\n');

  // Test 11: Real-world scenario - 47 minutes at $25/hour
  console.log('Test 11: Real-world scenario - 47 minutes at $25/hour');
  const startTime11 = new Date('2026-04-12T14:30:00Z');
  const endTime11 = new Date('2026-04-12T15:17:00Z');
  const result11 = calculateBillingAmount(startTime11, endTime11, 25);
  console.log('Result:', result11);
  console.log('Expected: 47 min → rounded to 50 min → $20.83\n');
}

// Run tests
testBillingCalculation().catch(console.error);