const { db } = require('./config/firebase');
const admin = require('firebase-admin');

/**
 * Firestore Schema for Charging Requests:
 * - charging_requests collection:
 *   - id: string (auto-generated document ID)
 *   - userId: string (user who made the request)
 *   - location: {
 *       lat: number,
 *       lng: number
 *     }
 *   - vehicleType: string (type of vehicle)
 *   - status: string (OPEN, ASSIGNED, COMPLETED, CANCELLED)
 *   - timestamp: timestamp (when request was created)
 *   - updatedAt: timestamp (last update time)
 */

/**
 * Validates location coordinates
 * @param {Object} location - Location object with lat and lng
 * @returns {boolean} True if valid coordinates
 */
function validateLocation(location) {
  if (!location || typeof location !== 'object') return false;

  const { lat, lng } = location;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;

  // Basic coordinate validation
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Validates vehicle type
 * @param {string} vehicleType - Type of vehicle
 * @returns {boolean} True if valid vehicle type
 */
function validateVehicleType(vehicleType) {
  if (!vehicleType || typeof vehicleType !== 'string') return false;

  const validTypes = ['sedan', 'suv', 'truck', 'motorcycle', 'electric', 'hybrid'];
  return validTypes.includes(vehicleType.toLowerCase());
}

/**
 * Creates a new charging request
 * @param {string} userId - User ID making the request
 * @param {Object} location - Location with lat/lng
 * @param {string} vehicleType - Type of vehicle
 * @returns {Promise<Object>} Success/error response with request data
 */
async function createChargingRequest(userId, location, vehicleType) {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      return {
        success: false,
        error: 'Valid userId is required'
      };
    }

    if (!validateLocation(location)) {
      return {
        success: false,
        error: 'Valid location with lat and lng coordinates is required'
      };
    }

    if (!validateVehicleType(vehicleType)) {
      return {
        success: false,
        error: 'Valid vehicle type is required (sedan, suv, truck, motorcycle, electric, hybrid)'
      };
    }

    if (db) {
      // Firebase mode
      const requestData = {
        userId: userId,
        location: {
          lat: location.lat,
          lng: location.lng
        },
        vehicleType: vehicleType.toLowerCase(),
        status: 'OPEN',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('charging_requests').add(requestData);

      return {
        success: true,
        message: 'Charging request created successfully',
        request: {
          id: docRef.id,
          ...requestData,
          timestamp: new Date(), // For immediate response
          updatedAt: new Date()
        }
      };
    } else {
      // Mock mode
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

      // In a real app, you'd store this in a database
      console.log('Mock charging request created:', requestData);

      return {
        success: true,
        message: 'Charging request created successfully (mock mode)',
        request: requestData
      };
    }

  } catch (error) {
    console.error('Error creating charging request:', error);
    return {
      success: false,
      error: 'Failed to create charging request'
    };
  }
}

/**
 * Gets a charging request by ID
 * @param {string} requestId - Request ID to retrieve
 * @returns {Promise<Object>} Success/error response with request data
 */
async function getChargingRequest(requestId) {
  try {
    if (!requestId || typeof requestId !== 'string') {
      return {
        success: false,
        error: 'Valid request ID is required'
      };
    }

    if (db) {
      // Firebase mode
      const docRef = db.collection('charging_requests').doc(requestId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return {
          success: false,
          error: 'Charging request not found'
        };
      }

      const data = doc.data();
      return {
        success: true,
        request: {
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        }
      };
    } else {
      // Mock mode - return mock data for testing
      return {
        success: false,
        error: 'Charging request not found (mock mode - no persistent storage)'
      };
    }

  } catch (error) {
    console.error('Error getting charging request:', error);
    return {
      success: false,
      error: 'Failed to retrieve charging request'
    };
  }
}

module.exports = {
  createChargingRequest,
  getChargingRequest,
  validateLocation,
  validateVehicleType
};