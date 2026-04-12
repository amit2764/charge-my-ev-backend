const {
  calculateTrustScore,
  updateUserTrustScore,
  getUserTrustProfile,
  getUsersTrustProfiles,
  getAllTrustProfiles,
  getTrustScoreGuidance,
  setMockTrustProfiles,
  clearMockTrustProfiles,
  CONFIG
} = require('./src/trust-score');
const { mockMode } = require('./src/config/firebase');

// Comprehensive Trust Score System Tests
async function testTrustScoreSystem() {
  console.log('=== TRUST SCORE SYSTEM COMPREHENSIVE TEST ===\n');

  // Test 1: Configuration validation
  console.log('TEST 1: Configuration Validation');
  console.log('─'.repeat(50));
  console.log(`Completion rate weight: ${CONFIG.COMPLETION_RATE_WEIGHT} points`);
  console.log(`Cancellation rate weight: ${CONFIG.CANCELLATION_RATE_WEIGHT} points`);
  console.log(`Ratings weight: ${CONFIG.RATINGS_WEIGHT} points`);
  console.log(`Total: ${CONFIG.COMPLETION_RATE_WEIGHT + CONFIG.CANCELLATION_RATE_WEIGHT + CONFIG.RATINGS_WEIGHT} points`);
  console.log(`Trust levels: ${Object.keys(CONFIG.TRUST_LEVELS).join(', ')}`);
  console.log(`✓ Configuration validated\n`);

  // Test 2: Calculate trust score - various scenarios
  console.log('TEST 2: Trust Score Calculation');
  console.log('─'.repeat(50));

  const scenarios = [
    {
      name: 'Excellent user (high completion, low cancellation, 5-star)',
      metrics: { completionRate: 100, cancellationRate: 0, averageRating: 5 },
      expectedLevel: 'EXCELLENT'
    },
    {
      name: 'Good user (80% completion, 10% cancellation, 4-star)',
      metrics: { completionRate: 80, cancellationRate: 10, averageRating: 4 },
      expectedLevel: 'GOOD'
    },
    {
      name: 'Fair user (60% completion, 20% cancellation, 3-star)',
      metrics: { completionRate: 60, cancellationRate: 20, averageRating: 3 },
      expectedLevel: 'FAIR'
    },
    {
      name: 'Poor user (30% completion, 50% cancellation, 1-star)',
      metrics: { completionRate: 30, cancellationRate: 50, averageRating: 1 },
      expectedLevel: 'POOR'
    },
    {
      name: 'No history (0%/0%/0)',
      metrics: { completionRate: 0, cancellationRate: 0, averageRating: 0 },
      expectedLevel: 'POOR'
    }
  ];

  for (const scenario of scenarios) {
    const result = calculateTrustScore(scenario.metrics);
    const match = result.trustLevel === scenario.expectedLevel ? '✓' : '✗';
    console.log(`${match} ${scenario.name}`);
    console.log(`  Score: ${result.trustScore}/100 (${result.trustLevel})`);
    console.log(`  Breakdown: C=${result.breakdown.completionScore} + CAN=${result.breakdown.cancellationScore} + R=${result.breakdown.ratingsScore}\n`);
  }
  console.log();

  // Test 3: Score calculation accuracy
  console.log('TEST 3: Score Calculation Accuracy');
  console.log('─'.repeat(50));

  const accuracyTests = [
    {
      metrics: { completionRate: 100, cancellationRate: 0, averageRating: 5 },
      description: 'Perfect: 100% completion, 0% cancellation, 5-star',
      expectedScore: 100
    },
    {
      metrics: { completionRate: 50, cancellationRate: 50, averageRating: 2.5 },
      description: 'Moderate: 50% completion, 50% cancellation, 2.5-star',
      expectedScore: 50 // (50/100)*40 + (50/100)*30 + (2.5/5)*30 = 20+15+15 = 50
    },
    {
      metrics: { completionRate: 0, cancellationRate: 100, averageRating: 0 },
      description: 'Worst: 0% completion, 100% cancellation, 0-star',
      expectedScore: 0
    }
  ];

  for (const test of accuracyTests) {
    const result = calculateTrustScore(test.metrics);
    const accuracy = result.trustScore === test.expectedScore ? '✓' : '~';
    console.log(`${accuracy} ${test.description}`);
    console.log(`  Expected: ${test.expectedScore}, Got: ${result.trustScore}\n`);
  }
  console.log();

  // Test 4: Input validation
  console.log('TEST 4: Input Validation');
  console.log('─'.repeat(50));

  const invalidInputs = [
    {
      desc: 'Completion rate > 100',
      metrics: { completionRate: 150, cancellationRate: 10, averageRating: 3 }
    },
    {
      desc: 'Cancellation rate < 0',
      metrics: { completionRate: 50, cancellationRate: -10, averageRating: 3 }
    },
    {
      desc: 'Rating > 5',
      metrics: { completionRate: 50, cancellationRate: 10, averageRating: 6 }
    },
    {
      desc: 'Invalid object',
      metrics: null
    }
  ];

  for (const test of invalidInputs) {
    const result = calculateTrustScore(test.metrics);
    const isError = !result.success ? '✓' : '✗';
    console.log(`${isError} ${test.desc}: ${!result.success ? 'Correctly rejected' : 'Should reject'}`);
  }
  console.log();

  // Test 5: Trust level guidance
  console.log('TEST 5: Trust Level Guidance');
  console.log('─'.repeat(50));

  const guidanceTests = [
    { score: 95, level: 'EXCELLENT' },
    { score: 75, level: 'GOOD' },
    { score: 60, level: 'FAIR' },
    { score: 30, level: 'POOR' }
  ];

  for (const test of guidanceTests) {
    const guidance = getTrustScoreGuidance(test.score);
    const match = guidance.level === test.level ? '✓' : '✗';
    console.log(`${match} Score ${test.score}/100 → ${guidance.level}`);
    console.log(`  Description: ${guidance.description}`);
    console.log(`  Recommendations: ${guidance.recommendations}\n`);
  }
  console.log();

  // Test 6: User trust profile management
  if (mockMode) {
    console.log('TEST 6: User Trust Profile Management');
    console.log('─'.repeat(50));

    clearMockTrustProfiles();

    // Create test profiles
    const updateResult1 = await updateUserTrustScore('user1', {
      completionRate: 95,
      cancellationRate: 5,
      averageRating: 4.8
    });
    console.log(`✓ Created user1 profile: score=${updateResult1.profile.trustScore}`);

    const updateResult2 = await updateUserTrustScore('user2', {
      completionRate: 65,
      cancellationRate: 25,
      averageRating: 3.2
    });
    console.log(`✓ Created user2 profile: score=${updateResult2.profile.trustScore}`);

    // Get individual profile
    const getResult = await getUserTrustProfile('user1');
    console.log(`✓ Retrieved user1: score=${getResult.profile.trustScore}, level=${getResult.profile.trustLevel}`);

    // Get multiple profiles
    const batchResult = await getUsersTrustProfiles(['user1', 'user2']);
    console.log(`✓ Retrieved ${batchResult.count} profiles`);

    // Get all profiles
    const allResult = await getAllTrustProfiles();
    console.log(`✓ Total profiles: ${allResult.stats.totalUsers}`);
    console.log(`  Average trust score: ${allResult.stats.averageTrustScore}`);
    console.log(`  Distribution: ${JSON.stringify(allResult.stats.trustLevelDistribution)}\n`);
  } else {
    console.log('TEST 6: User Trust Profile Management');
    console.log('─'.repeat(50));
    console.log('(Skipped - requires mock mode)\n');
  }

  // Test 7: Edge case - ratings impact
  console.log('TEST 7: Ratings Impact Analysis');
  console.log('─'.repeat(50));

  const ratingTests = [
    { rating: 5, desc: '5-star (excellent)' },
    { rating: 4, desc: '4-star (good)' },
    { rating: 3, desc: '3-star (fair)' },
    { rating: 2, desc: '2-star (poor)' },
    { rating: 1, desc: '1-star (very poor)' },
    { rating: 0, desc: '0-star (no rating)' }
  ];

  console.log('Impact on final score (assuming 100% completion, 0% cancellation):\n');
  for (const test of ratingTests) {
    const result = calculateTrustScore({
      completionRate: 100,
      cancellationRate: 0,
      averageRating: test.rating
    });
    console.log(`  ${test.desc}: ${result.trustScore}/100 (+${result.breakdown.ratingsScore} from ratings)`);
  }
  console.log();

  // Test 8: Edge case - completion/cancellation trade-off
  console.log('TEST 8: Completion vs Cancellation Trade-off');
  console.log('─'.repeat(50));

  const tradeoffTests = [
    { completion: 100, cancellation: 0, desc: 'Perfect' },
    { completion: 90, cancellation: 10, desc: 'High completion, low cancellation' },
    { completion: 70, cancellation: 30, desc: 'Balanced' },
    { completion: 50, cancellation: 50, desc: 'High risk' },
    { completion: 30, cancellation: 70, desc: 'Very risky' }
  ];

  console.log('Impact on final score (assuming 3-star rating):\n');
  for (const test of tradeoffTests) {
    const result = calculateTrustScore({
      completionRate: test.completion,
      cancellationRate: test.cancellation,
      averageRating: 3
    });
    console.log(`  ${test.desc}: ${result.trustScore}/100`);
    console.log(`    (Completion: ${result.breakdown.completionScore}, Cancellation: ${result.breakdown.cancellationScore})\n`);
  }

  console.log('='.repeat(50));
  console.log('Trust Score System Tests Complete!');
  console.log('='.repeat(50));
}

// Run tests
testTrustScoreSystem().catch(console.error);
