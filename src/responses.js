const { db } = require('./config/firebase');
const admin = require('firebase-admin');

/**
 * Firestore Schema for Host Responses:
 * - host_responses collection:
 *   - id: string (auto-generated document ID)
 *   - requestId: string (charging request ID)
 *   - hostId: string (host user ID)
 *   - status: string (ACCEPTED, DECLINED, PENDING)
 *   - message: string (optional message from host)
 *   - estimatedArrival: number (minutes until host arrives)
 *   - price: number (offered price per hour)
 *   - timestamp: timestamp (when response was created)
 *   - updatedAt: timestamp (last update time)
 */

// Mock storage for responses (for testing without Firebase)
const mockResponses = new Map();

/**
 * Validate that a host hasn't already responded to a request
 * @param {string} requestId - Charging request ID
 * @param {string} hostId - Host user ID
 * @returns {Promise<boolean>} True if response doesn't exist
 */
async function validateUniqueResponse(requestId, hostId) {
  if (db) {
    // Firebase mode
    const responsesRef = db.collection('host_responses');
    const existingResponse = await responsesRef
      .where('requestId', '==', requestId)
      .where('hostId', '==', hostId)
      .limit(1)
      .get();

    return existingResponse.empty;
  } else {
    // Mock mode - check mock storage
    const key = `${requestId}_${hostId}`;
    return !mockResponses.has(key);
  }
}

/**
 * Create a host response to a charging request
 * @param {string} requestId - Charging request ID
 * @param {string} hostId - Host user ID
 * @param {Object} responseData - Additional response data
 * @returns {Promise<Object>} Success/error response
 */
async function findAcceptedResponse(requestId) {
  if (db) {
    const responsesRef = db.collection('host_responses');
    const snapshot = await responsesRef
      .where('requestId', '==', requestId)
      .where('status', '==', 'ACCEPTED')
      .limit(1)
      .get();

    return !snapshot.empty;
  }

  for (const response of mockResponses.values()) {
    if (response.requestId === requestId && response.status === 'ACCEPTED') {
      return true;
    }
  }

  return false;
}

async function createHostResponse(requestId, hostId, responseData = {}) {
  try {
    // Validate required inputs
    if (!requestId || typeof requestId !== 'string') {
      return {
        success: false,
        error: 'Valid requestId is required'
      };
    }

    if (!hostId || typeof hostId !== 'string') {
      return {
        success: false,
        error: 'Valid hostId is required'
      };
    }

    // Validate response data
    const {
      status = 'PENDING',
      message = '',
      estimatedArrival,
      price
    } = responseData;

    const validStatuses = ['ACCEPTED', 'DECLINED', 'PENDING'];
    if (!validStatuses.includes(status.toUpperCase())) {
      return {
        success: false,
        error: 'Invalid status. Must be ACCEPTED, DECLINED, or PENDING'
      };
    }

    if (estimatedArrival !== undefined && (typeof estimatedArrival !== 'number' || estimatedArrival < 0)) {
      return {
        success: false,
        error: 'Estimated arrival must be a positive number (minutes)'
      };
    }

    if (price !== undefined && (typeof price !== 'number' || price < 0)) {
      return {
        success: false,
        error: 'Price must be a positive number'
      };
    }

    if (db) {
      // Firebase mode: Use transaction for atomic response creation
      return await db.runTransaction(async (transaction) => {
        // Step 1: Check if host has already responded to this request
        const existingResponseQuery = db.collection('host_responses')
          .where('requestId', '==', requestId)
          .where('hostId', '==', hostId)
          .limit(1);

        const existingResponseSnapshot = await transaction.get(existingResponseQuery);

        if (!existingResponseSnapshot.empty) {
          throw new Error('DUPLICATE_RESPONSE: Host has already responded to this request');
        }

        // Step 2: If status is ACCEPTED, check if another response is already accepted
        if (status.toUpperCase() === 'ACCEPTED') {
          const acceptedResponseQuery = db.collection('host_responses')
            .where('requestId', '==', requestId)
            .where('status', '==', 'ACCEPTED')
            .limit(1);

          const acceptedResponseSnapshot = await transaction.get(acceptedResponseQuery);

          if (!acceptedResponseSnapshot.empty) {
            throw new Error('MULTIPLE_ACCEPTED: A request already has an accepted response');
          }
        }

        // Step 3: Create the response
        const response = {
          requestId: requestId,
          hostId: hostId,
          status: status.toUpperCase(),
          message: message || '',
          estimatedArrival: estimatedArrival || null,
          price: price || null,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = db.collection('host_responses').doc();
        transaction.set(docRef, response);

        return {
          success: true,
          message: 'Host response created successfully',
          response: {
            id: docRef.id,
            ...response,
            timestamp: new Date(),
            updatedAt: new Date()
          }
        };
      });
    } else {
      // Mock mode
      const responseId = `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const response = {
        id: responseId,
        requestId: requestId,
        hostId: hostId,
        status: status.toUpperCase(),
        message: message || '',
        estimatedArrival: estimatedArrival || null,
        price: price || null,
        timestamp: new Date(),
        updatedAt: new Date()
      };

      // Store in mock storage
      const key = `${requestId}_${hostId}`;
      mockResponses.set(key, response);

      console.log('Mock host response created:', response);

      return {
        success: true,
        message: 'Host response created successfully (mock mode)',
        response: response
      };
    }

  } catch (error) {
    console.error('Error creating host response:', error);

    if (error.message === 'DUPLICATE_RESPONSE: Host has already responded to this request') {
      return {
        success: false,
        error: 'Host has already responded to this request'
      };
    }

    if (error.message === 'MULTIPLE_ACCEPTED: A request already has an accepted response') {
      return {
        success: false,
        error: 'A request already has an accepted response. Only one host may accept at a time.'
      };
    }

    return {
      success: false,
      error: 'Failed to create host response'
    };
  }
}

/**
 * Get all responses for a specific charging request
 * @param {string} requestId - Charging request ID
 * @returns {Promise<Object>} Success/error response with responses array
 */
async function getResponsesForRequest(requestId) {
  try {
    if (!requestId || typeof requestId !== 'string') {
      return {
        success: false,
        error: 'Valid request ID is required'
      };
    }

    if (db) {
      // Firebase mode
      const responsesRef = db.collection('host_responses');
      const snapshot = await responsesRef
        .where('requestId', '==', requestId)
        .orderBy('timestamp', 'desc')
        .get();

      const responses = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        responses.push({
          id: doc.id,
          ...data,
          timestamp: data.timestamp?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        });
      });

      return {
        success: true,
        count: responses.length,
        requestId: requestId,
        responses: responses
      };
    } else {
      // Mock mode - return responses from mock storage
      const responses = [];
      for (const [key, response] of mockResponses.entries()) {
        if (response.requestId === requestId) {
          responses.push(response);
        }
      }

      // Sort by timestamp (newest first)
      responses.sort((a, b) => b.timestamp - a.timestamp);

      return {
        success: true,
        count: responses.length,
        requestId: requestId,
        responses: responses
      };
    }

  } catch (error) {
    console.error('Error getting responses for request:', error);
    return {
      success: false,
      error: 'Failed to retrieve responses'
    };
  }
}

/**
 * Update a host response (for status changes, price updates, etc.)
 * @param {string} responseId - Response ID to update
 * @param {Object} updateData - Fields to update
 * @returns {Promise<Object>} Success/error response
 */
async function updateHostResponse(responseId, updateData) {
  try {
    if (!responseId || typeof responseId !== 'string') {
      return {
        success: false,
        error: 'Valid response ID is required'
      };
    }

    if (!updateData || typeof updateData !== 'object') {
      return {
        success: false,
        error: 'Valid update data is required'
      };
    }

    // Validate update data
    const validFields = ['status', 'message', 'estimatedArrival', 'price'];
    const invalidFields = Object.keys(updateData).filter(field => !validFields.includes(field));

    if (invalidFields.length > 0) {
      return {
        success: false,
        error: `Invalid fields: ${invalidFields.join(', ')}`
      };
    }

    if (updateData.status) {
      const validStatuses = ['ACCEPTED', 'DECLINED', 'PENDING'];
      if (!validStatuses.includes(updateData.status.toUpperCase())) {
        return {
          success: false,
          error: 'Invalid status. Must be ACCEPTED, DECLINED, or PENDING'
        };
      }
      updateData.status = updateData.status.toUpperCase();
    }

    if (updateData.estimatedArrival !== undefined && (typeof updateData.estimatedArrival !== 'number' || updateData.estimatedArrival < 0)) {
      return {
        success: false,
        error: 'Estimated arrival must be a positive number (minutes)'
      };
    }

    if (updateData.price !== undefined && (typeof updateData.price !== 'number' || updateData.price < 0)) {
      return {
        success: false,
        error: 'Price must be a positive number'
      };
    }

    if (db) {
      // Firebase mode
      const responseRef = db.collection('host_responses').doc(responseId);
      const doc = await responseRef.get();

      if (!doc.exists) {
        return {
          success: false,
          error: 'Response not found'
        };
      }

      updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

      await responseRef.update(updateData);

      // Get updated document
      const updatedDoc = await responseRef.get();
      const data = updatedDoc.data();

      return {
        success: true,
        message: 'Response updated successfully',
        response: {
          id: updatedDoc.id,
          ...data,
          timestamp: data.timestamp?.toDate(),
          updatedAt: data.updatedAt?.toDate()
        }
      };
    } else {
      // Mock mode
      return {
        success: false,
        error: 'Response update not supported in mock mode'
      };
    }

  } catch (error) {
    console.error('Error updating host response:', error);
    return {
      success: false,
      error: 'Failed to update response'
    };
  }
}

module.exports = {
  createHostResponse,
  getResponsesForRequest,
  updateHostResponse,
  validateUniqueResponse
};