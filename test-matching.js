const { getNearbyChargers, calculateDistance, toRadians } = require('./src/matching');

// Test the matching system
async function testMatchingSystem() {
  console.log('=== Charging Station Matching System Test ===\n');

  // Test 1: Distance calculation
  console.log('Test 1: Distance Calculation using Haversine formula...');

  const point1 = { lat: 37.7749, lng: -122.4194 }; // San Francisco
  const point2 = { lat: 37.7849, lng: -122.4294 }; // Nearby point
  const point3 = { lat: 34.0522, lng: -118.2437 }; // Los Angeles

  const distance1 = calculateDistance(point1, point2);
  const distance2 = calculateDistance(point1, point3);

  console.log(`Distance SF to nearby: ${distance1.toFixed(2)} km`);
  console.log(`Distance SF to LA: ${distance2.toFixed(2)} km`);

  // Test 2: Get nearby chargers (default 3km radius)
  console.log('\nTest 2: Finding nearby chargers (3km radius)...');
  const nearbyResult = await getNearbyChargers(point1);
  console.log('Nearby chargers found:', nearbyResult.count);
  console.log('Stations:');
  nearbyResult.stations.forEach((station, index) => {
    console.log(`  ${index + 1}. ${station.name} - ${station.distance} km away`);
  });

  // Test 3: Get nearby chargers with custom radius
  console.log('\nTest 3: Finding nearby chargers (5km radius)...');
  const nearbyResult5km = await getNearbyChargers(point1, 5);
  console.log('Nearby chargers found:', nearbyResult5km.count);

  // Test 4: Get nearby chargers from different location
  console.log('\nTest 4: Finding nearby chargers from LA...');
  const nearbyResultLA = await getNearbyChargers(point3, 10);
  console.log('Nearby chargers found from LA:', nearbyResultLA.count);

  // Test 5: Validation tests
  console.log('\nTest 5: Validation tests...');

  // Invalid location
  const invalidLocationResult = await getNearbyChargers(null);
  console.log('Null location:', invalidLocationResult.success ? 'PASS' : 'FAIL');

  // Invalid coordinates
  const invalidCoordsResult = await getNearbyChargers({ lat: 100, lng: -122.4194 });
  console.log('Invalid coordinates:', invalidCoordsResult.success ? 'FAIL' : 'PASS');

  // Invalid radius
  const invalidRadiusResult = await getNearbyChargers(point1, -1);
  console.log('Negative radius:', invalidRadiusResult.success ? 'FAIL' : 'PASS');

  // Test 6: Distance calculation edge cases
  console.log('\nTest 6: Distance calculation edge cases...');

  // Same point
  const samePointDistance = calculateDistance(point1, point1);
  console.log(`Distance from point to itself: ${samePointDistance} km`);

  // Antipodal points (opposite sides of Earth)
  const antipodal1 = { lat: 0, lng: 0 };
  const antipodal2 = { lat: 0, lng: 180 };
  const antipodalDistance = calculateDistance(antipodal1, antipodal2);
  console.log(`Antipodal distance: ${antipodalDistance.toFixed(2)} km (should be ~${Math.PI * 6371} km)`);

  // Test 7: Performance test with multiple calculations
  console.log('\nTest 7: Performance test (1000 distance calculations)...');
  const startTime = Date.now();

  for (let i = 0; i < 1000; i++) {
    calculateDistance(
      { lat: Math.random() * 180 - 90, lng: Math.random() * 360 - 180 },
      { lat: Math.random() * 180 - 90, lng: Math.random() * 360 - 180 }
    );
  }

  const endTime = Date.now();
  console.log(`1000 calculations took: ${endTime - startTime} ms`);

  console.log('\n=== Test Complete ===');

  // Explain the distance calculation
  console.log('\n=== Distance Calculation Explanation ===');
  console.log(`
The Haversine formula calculates the great-circle distance between two points on a sphere.

Formula: d = 2 * r * arcsin(sqrt(sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)))

Where:
- r = Earth's radius (6371 km)
- φ = latitude in radians
- λ = longitude in radians
- Δφ = difference in latitude
- Δλ = difference in longitude

This gives the shortest distance over the Earth's surface, accounting for the spherical shape.

Optimization Logic:
1. Convert degrees to radians once per coordinate
2. Use lookup table for Earth's radius if needed
3. Filter stations by rough bounding box before precise distance calculation
4. Sort results by distance for better user experience
5. Cache frequently accessed station data
6. Use geospatial database queries when available (instead of in-memory filtering)
  `);
}

// Run the test
testMatchingSystem().catch(console.error);