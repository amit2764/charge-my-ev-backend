const { calculateBillingAmount } = require('./src/billing');

// Comprehensive Billing Logic Demonstration
async function demonstrateBillingLogic() {
  console.log('=== BILLING LOGIC COMPREHENSIVE TEST ===\n');

  // Test Suite 1: Basic Billing Scenarios
  console.log('TEST SUITE 1: Basic Billing Scenarios');
  console.log('─'.repeat(50));

  const scenarios = [
    { duration: '1 min', price: 50, expected: '$8.33', desc: 'Minimum charge' },
    { duration: '10 min', price: 50, expected: '$8.33', desc: 'Exact boundary' },
    { duration: '15 min', price: 50, expected: '$16.67', desc: 'Between boundaries' },
    { duration: '45 min', price: 30, expected: '$25.00', desc: 'Large duration' },
    { duration: '60 min', price: 25, expected: '$25.00', desc: 'One hour' }
  ];

  for (const scenario of scenarios) {
    // Parse duration
    const durationMs = parseInt(scenario.duration) * 60 * 1000;
    const startTime = new Date(Date.now() - durationMs);
    const endTime = new Date();

    const result = calculateBillingAmount(startTime, endTime, scenario.price);

    console.log(`\n${scenario.desc}: ${scenario.duration} at $${scenario.price}/hour`);
    console.log(`  Actual Duration: ${result.duration} min`);
    console.log(`  Rounded Duration: ${result.roundedDuration} min`);
    console.log(`  Final Amount: $${result.totalAmount.toFixed(2)}`);
    console.log(`  Expected: ${scenario.expected} ${result.totalAmount.toFixed(2) === scenario.expected ? '✓' : '✗'}`);
  }

  // Test Suite 2: Buffer Scenarios
  console.log('\n\nTEST SUITE 2: Buffer Scenarios');
  console.log('─'.repeat(50));

  const bufferScenarios = [
    { duration: '10 min', buffer: 0, price: 50, desc: 'No buffer' },
    { duration: '10 min', buffer: 5, price: 50, desc: '5-min buffer' },
    { duration: '10 min', buffer: 15, price: 50, desc: '15-min buffer' },
  ];

  for (const scenario of bufferScenarios) {
    const durationMs = parseInt(scenario.duration) * 60 * 1000;
    const startTime = new Date(Date.now() - durationMs);
    const endTime = new Date();

    const result = calculateBillingAmount(startTime, endTime, scenario.price, scenario.buffer);

    console.log(`\n${scenario.desc}: ${scenario.duration} + ${scenario.buffer}min buffer`);
    console.log(`  Total Before Rounding: ${(result.duration + scenario.buffer).toFixed(2)} min`);
    console.log(`  Rounded Duration: ${result.roundedDuration} min`);
    console.log(`  Final Amount: $${result.totalAmount.toFixed(2)}`);
  }

  // Test Suite 3: Billing Accuracy
  console.log('\n\nTEST SUITE 3: Rounding Accuracy');
  console.log('─'.repeat(50));

  const roundingTests = [
    { minutes: 1, expected: 10, desc: '1→10' },
    { minutes: 5, expected: 10, desc: '5→10' },
    { minutes: 11, expected: 20, desc: '11→20' },
    { minutes: 25, expected: 30, desc: '25→30' },
    { minutes: 35, expected: 40, desc: '35→40' },
    { minutes: 59, expected: 60, desc: '59→60' },
    { minutes: 61, expected: 70, desc: '61→70' },
    { minutes: 100, expected: 100, desc: '100→100' },
  ];

  for (const test of roundingTests) {
    const startTime = new Date('2026-04-12T10:00:00Z');
    const endTime = new Date(startTime.getTime() + test.minutes * 60 * 1000);

    const result = calculateBillingAmount(startTime, endTime, 60);
    const passed = result.roundedDuration === test.expected ? '✓' : '✗';

    console.log(`  ${test.desc}: ${passed} (got ${result.roundedDuration})`);
  }

  // Test Suite 4: Price Calculations
  console.log('\n\nTEST SUITE 4: Price Calculation Accuracy');
  console.log('─'.repeat(50));

  const priceTests = [
    { mins: 30, price: 60, expected: '$30.00', desc: '30min @ $60/hr' },
    { mins: 45, price: 40, expected: '$30.00', desc: '45min @ $40/hr' },
    { mins: 25, price: 100, expected: '$50.00', desc: '25min @ $100/hr' },
    { mins: 7, price: 120, expected: '$20.00', desc: '7min @ $120/hr' },
  ];

  for (const test of priceTests) {
    const startTime = new Date('2026-04-12T10:00:00Z');
    const endTime = new Date(startTime.getTime() + test.mins * 60 * 1000);

    const result = calculateBillingAmount(startTime, endTime, test.price);

    console.log(`\n${test.desc}`);
    console.log(`  Actual: ${test.mins} min → Rounded: ${result.roundedDuration} min`);
    console.log(`  Amount: $${result.totalAmount.toFixed(2)} (expected: ${test.expected})`);
  }

  // Test Suite 5: Error Handling
  console.log('\n\nTEST SUITE 5: Error Handling');
  console.log('─'.repeat(50));

  const errorTests = [
    { desc: 'Missing endTime', params: [new Date(), undefined, 50], expected: 'endTime required' },
    { desc: 'Negative price', params: [new Date('2026-04-12T10:00Z'), new Date('2026-04-12T10:15Z'), -50], expected: 'non-negative' },
    { desc: 'EndTime before startTime', params: [new Date('2026-04-12T10:15Z'), new Date('2026-04-12T10:00Z'), 50], expected: 'after startTime' },
  ];

  for (const test of errorTests) {
    const result = calculateBillingAmount(...test.params);
    const passed = !result.success ? '✓' : '✗';
    console.log(`  ${test.desc}: ${passed}`);
    if (!result.success) console.log(`    Error: ${result.error}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('Billing Logic Comprehensive Test Complete!');
  console.log('='.repeat(50) + '\n');
}

// Run demonstration
demonstrateBillingLogic().catch(console.error);