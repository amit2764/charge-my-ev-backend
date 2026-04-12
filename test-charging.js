const { createChargingRequest, getChargingRequest, validateLocation, validateVehicleType } = require('./src/charging');

// Mock database for testing (replace with actual Firebase in production)
const mockRequests = new Map();

// Override the charging module's database calls for testing
const originalCharging = require('./src/charging');
originalCharging.createChargingRequest = async (userId, location, vehicleType) => {
  try {
    if (!userId || typeof userId !== 'string') {
      return { success: false, error: 'Valid userId is required' };
    }

    if (!validateLocation(location)) {
      return { success: false, error: 'Valid location with lat and lng coordinates is required' };
    }

    if (!validateVehicleType(vehicleType)) {
      return { success: false, error: 'Valid vehicle type is required (sedan, suv, truck, motorcycle, electric, hybrid)' };
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const requestData = {
      id: requestId,
      userId: userId,
      location: {
        lat: location.lat,
        lng: location.lng
      },
      vehicleType: vehicleType.toLowerCase(),
      status: 'OPEN',
      timestamp: new Date(),
      updatedAt: new Date()
    };

    mockRequests.set(requestId, requestData);

    console.log('Mock charging request created:', requestData);

    return {
      success: true,
      message: 'Charging request created successfully (mock mode)',
      request: requestData
    };

  } catch (error) {
    return { success: false, error: 'Failed to create charging request' };
  }
};

originalCharging.getChargingRequest = async (requestId) => {
  try {
    if (!requestId || typeof requestId !== 'string') {
      return { success: false, error: 'Valid request ID is required' };
    }

    const request = mockRequests.get(requestId);
    if (!request) {
      return { success: false, error: 'Charging request not found' };
    }

    return {
      success: true,
      request: request
    };

  } catch (error) {
    return { success: false, error: 'Failed to retrieve charging request' };
  }
};

// Test the charging request system
async function testChargingSystem() {
  console.log('=== Charging Request System Test ===\n');

  // Test 1: Create charging request
  console.log('Test 1: Creating charging request...');
  const createResult = await originalCharging.createChargingRequest(
    'user123',
    { lat: 37.7749, lng: -122.4194 },
    'electric'
  );
  console.log('Create Result:', createResult);

  const requestId = createResult.request?.id;

  console.log('\nTest 2: Getting charging request by ID...');
  if (requestId) {
    const getResult = await originalCharging.getChargingRequest(requestId);
    console.log('Get Result:', getResult);
  }

  console.log('\nTest 3: Validation tests...');
  console.log('Valid location (37.7749, -122.4194):', validateLocation({ lat: 37.7749, lng: -122.4194 }));
  console.log('Invalid location (lat only):', validateLocation({ lat: 37.7749 }));
  console.log('Invalid location (out of range):', validateLocation({ lat: 100, lng: -122.4194 }));

  console.log('\nValid vehicle types:');
  console.log('electric:', validateVehicleType('electric'));
  console.log('SUV:', validateVehicleType('SUV'));
  console.log('Invalid vehicle type "car":', validateVehicleType('car'));

  console.log('\nTest 4: Error cases...');
  const errorResult1 = await originalCharging.createChargingRequest('', { lat: 37.7749, lng: -122.4194 }, 'electric');
  console.log('Empty userId:', errorResult1);

  const errorResult2 = await originalCharging.createChargingRequest('user123', null, 'electric');
  console.log('Null location:', errorResult2);

  const errorResult3 = await originalCharging.createChargingRequest('user123', { lat: 37.7749, lng: -122.4194 }, 'invalid');
  console.log('Invalid vehicle type:', errorResult3);

  const errorResult4 = await originalCharging.getChargingRequest('nonexistent');
  console.log('Non-existent request:', errorResult4);

  console.log('\n=== Test Complete ===');
}

// Run the test
testChargingSystem().catch(console.error);