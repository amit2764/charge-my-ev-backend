const { db } = require('./config/firebase');
const admin = require('firebase-admin');
const redis = require('./lib/redis');

/**
 * Firestore Schema for Charging Stations:
 * - charging_stations collection:
 *   - id: string (auto-generated document ID)
 *   - hostId: string (user ID of the host)
 *   - location: {
 *       lat: number,
 *       lng: number
 *     }
 *   - name: string (station name)
 *   - address: string (full address)
 *   - chargerType: string (Level 1, Level 2, DC Fast)
 *   - powerOutput: number (in kW)
 *   - availability: string (AVAILABLE, OCCUPIED, MAINTENANCE)
 *   - pricePerHour: number (cost per hour)
 *   - amenities: array (WiFi, Restroom, etc.)
 *   - createdAt: timestamp
 *   - updatedAt: timestamp
 */

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Object} point1 - First point with lat/lng
 * @param {Object} point2 - Second point with lat/lng
 * @returns {number} Distance in kilometers
 */
function calculateDistance(point1, point2) {
  const R = 6371; // Earth's radius in kilometers

  const lat1Rad = toRadians(point1.lat);
  const lat2Rad = toRadians(point2.lat);
  const deltaLatRad = toRadians(point2.lat - point1.lat);
  const deltaLngRad = toRadians(point2.lng - point1.lng);

  // Haversine formula
  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;

  return distance;
}

/**
 * Convert degrees to radians
 * @param {number} degrees - Angle in degrees
 * @returns {number} Angle in radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Get nearby charging stations within a specified radius
 * @param {Object} userLocation - User's location with lat/lng
 * @param {number} radiusKm - Search radius in kilometers (default: 3)
 * @returns {Promise<Object>} Success/error response with nearby stations
 */
async function getNearbyChargers(userLocation, radiusKm = 3) {
  try {
    // Validate user location
    if (!userLocation || !userLocation.lat || !userLocation.lng) {
      return {
        success: false,
        error: 'Valid user location with lat and lng is required'
      };
    }

    if (typeof userLocation.lat !== 'number' || typeof userLocation.lng !== 'number') {
      return {
        success: false,
        error: 'Location coordinates must be numbers'
      };
    }

    if (userLocation.lat < -90 || userLocation.lat > 90 ||
        userLocation.lng < -180 || userLocation.lng > 180) {
      return {
        success: false,
        error: 'Invalid coordinate ranges'
      };
    }

    if (typeof radiusKm !== 'number' || radiusKm <= 0 || radiusKm > 50) {
      return {
        success: false,
        error: 'Radius must be a number between 0 and 50 km'
      };
    }

    if (db) {
      // 1. Check Redis Cache First
      let cacheKey = null;
      if (redis) {
        // Group requests into a grid of ~1.1km by limiting decimal places to 2
        cacheKey = `chargers:nearby:${userLocation.lat.toFixed(2)}:${userLocation.lng.toFixed(2)}:${radiusKm}`;
        try {
          const cachedData = await redis.get(cacheKey);
          if (cachedData) {
            console.log(`[CACHE HIT] Returning cached nearby chargers for ${cacheKey}`);
            return JSON.parse(cachedData);
          }
        } catch (err) {
          console.warn('[CACHE ERROR] Failed to read from Redis:', err.message);
        }
      }

      // Firebase mode - query charging stations
      const stationsRef = db.collection('charging_stations');

      // Get all available stations (in production, you'd use geospatial queries)
      // For now, we'll fetch all and filter in memory
      const snapshot = await stationsRef
        .where('availability', '==', 'AVAILABLE')
        .get();

      const nearbyStations = [];

      snapshot.forEach(doc => {
        const station = doc.data();
        const distance = calculateDistance(userLocation, station.location);

        if (distance <= radiusKm) {
          nearbyStations.push({
            id: doc.id,
            ...station,
            distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
            location: station.location,
            createdAt: station.createdAt?.toDate(),
            updatedAt: station.updatedAt?.toDate()
          });
        }
      });

      // Sort by distance (closest first)
      nearbyStations.sort((a, b) => a.distance - b.distance);

      const result = {
        success: true,
        count: nearbyStations.length,
        radius: radiusKm,
        userLocation: userLocation,
        stations: nearbyStations
      };

      // 2. Save result to Redis Cache for 60 seconds
      if (redis && cacheKey) {
        try {
          await redis.set(cacheKey, JSON.stringify(result), 'EX', 60);
        } catch (err) {
          console.warn('[CACHE ERROR] Failed to write to Redis:', err.message);
        }
      }

      return result;
    } else {
      // Mock mode - return mock data
      const mockStations = [
        {
          id: 'station_001',
          hostId: 'host123',
          name: 'Downtown Charging Hub',
          address: '123 Main St, Downtown',
          location: { lat: 37.7749, lng: -122.4194 },
          chargerType: 'DC Fast',
          powerOutput: 150,
          availability: 'AVAILABLE',
          pricePerHour: 2.50,
          amenities: ['WiFi', 'Restroom', 'Parking'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'station_002',
          hostId: 'host456',
          name: 'Residential Charger',
          address: '456 Oak Ave, Residential Area',
          location: { lat: 37.7849, lng: -122.4294 },
          chargerType: 'Level 2',
          powerOutput: 11,
          availability: 'AVAILABLE',
          pricePerHour: 1.75,
          amenities: ['WiFi'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'station_003',
          hostId: 'host789',
          name: 'Mall Parking',
          address: '789 Shopping Center, Mall Area',
          location: { lat: 37.7649, lng: -122.4094 },
          chargerType: 'Level 2',
          powerOutput: 22,
          availability: 'AVAILABLE',
          pricePerHour: 2.00,
          amenities: ['WiFi', 'Restroom', 'Shopping'],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'station_004',
          hostId: 'host101',
          name: 'Office Building',
          address: '101 Business Park, Office District',
          location: { lat: 37.7549, lng: -122.3994 },
          chargerType: 'DC Fast',
          powerOutput: 100,
          availability: 'AVAILABLE',
          pricePerHour: 3.00,
          amenities: ['WiFi', 'Restroom', 'Security'],
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      // Calculate distances and filter by radius
      const nearbyStations = mockStations
        .map(station => ({
          ...station,
          distance: Math.round(calculateDistance(userLocation, station.location) * 100) / 100
        }))
        .filter(station => station.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance);

      return {
        success: true,
        count: nearbyStations.length,
        radius: radiusKm,
        userLocation: userLocation,
        stations: nearbyStations
      };
    }

  } catch (error) {
    console.error('Error getting nearby chargers:', error);
    return {
      success: false,
      error: 'Failed to retrieve nearby charging stations'
    };
  }
}

/**
 * Create a new charging station (for hosts to add their stations)
 * @param {Object} stationData - Station information
 * @returns {Promise<Object>} Success/error response
 */
async function createChargingStation(stationData) {
  try {
    const {
      hostId,
      name,
      address,
      location,
      chargerType,
      powerOutput,
      pricePerHour,
      amenities = []
    } = stationData;

    // Validation
    if (!hostId || !name || !address || !location || !chargerType) {
      return {
        success: false,
        error: 'Missing required fields'
      };
    }

    if (!location.lat || !location.lng) {
      return {
        success: false,
        error: 'Valid location coordinates required'
      };
    }

    const validChargerTypes = ['Level 1', 'Level 2', 'DC Fast'];
    if (!validChargerTypes.includes(chargerType)) {
      return {
        success: false,
        error: 'Invalid charger type'
      };
    }

    if (db) {
      // Firebase mode
      const station = {
        hostId,
        name,
        address,
        location: {
          lat: location.lat,
          lng: location.lng
        },
        chargerType,
        powerOutput: powerOutput || 0,
        availability: 'AVAILABLE',
        pricePerHour: pricePerHour || 0,
        amenities,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('charging_stations').add(station);

      return {
        success: true,
        message: 'Charging station created successfully',
        station: {
          id: docRef.id,
          ...station,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      };
    } else {
      // Mock mode
      const stationId = `station_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const station = {
        id: stationId,
        hostId,
        name,
        address,
        location: {
          lat: location.lat,
          lng: location.lng
        },
        chargerType,
        powerOutput: powerOutput || 0,
        availability: 'AVAILABLE',
        pricePerHour: pricePerHour || 0,
        amenities,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      console.log('Mock charging station created:', station);

      return {
        success: true,
        message: 'Charging station created successfully (mock mode)',
        station
      };
    }

  } catch (error) {
    console.error('Error creating charging station:', error);
    return {
      success: false,
      error: 'Failed to create charging station'
    };
  }
}

module.exports = {
  getNearbyChargers,
  createChargingStation,
  calculateDistance,
  toRadians
};