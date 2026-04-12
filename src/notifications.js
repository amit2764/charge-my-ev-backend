/**
 * Push Notification Service
 * Firebase Cloud Messaging (FCM) integration
 */

const admin = require('firebase-admin');
const { db } = require('./config/firebase');

/**
 * Notification payload structures for different events
 */
const NOTIFICATION_TYPES = {
  NEW_REQUEST: 'new_request',
  REQUEST_ACCEPTED: 'request_accepted',
  USER_ARRIVED: 'user_arrived',
  OTP_REQUIRED: 'otp_required',
  SESSION_STARTED: 'session_started',
  SESSION_STOPPED: 'session_stopped',
  PAYMENT_CONFIRMATION_REQUIRED: 'payment_confirmation_required',
  PAYMENT_DISPUTE: 'payment_dispute',
  PAYMENT_RESOLVED: 'payment_resolved'
};

/**
 * Send push notification to a user
 * @param {string} userId - Target user ID
 * @param {string} type - Notification type
 * @param {Object} data - Notification data
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Send result
 */
async function sendNotification(userId, type, data, options = {}) {
  try {
    // Get user's device tokens
    const userTokens = await getUserDeviceTokens(userId);
    if (!userTokens || userTokens.length === 0) {
      return {
        success: false,
        error: 'No device tokens found for user',
        userId
      };
    }

    // Build notification payload
    const payload = buildNotificationPayload(type, data);

    // Send to all user's devices
    const results = [];
    for (const token of userTokens) {
      try {
        const message = {
          token: token,
          notification: payload.notification,
          data: payload.data,
          android: {
            priority: options.priority || 'high',
            notification: {
              sound: 'default',
              clickAction: 'FLUTTER_NOTIFICATION_CLICK'
            }
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1
              }
            }
          }
        };

        const result = await admin.messaging().send(message);
        results.push({ token, success: true, messageId: result });

        // Log successful send
        console.log(`Notification sent to ${userId}: ${result}`);

      } catch (error) {
        console.error(`Failed to send notification to token ${token}:`, error);

        // Handle invalid tokens
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
          await removeInvalidToken(userId, token);
        }

        results.push({ token, success: false, error: error.message });
      }
    }

    return {
      success: true,
      userId,
      totalTokens: userTokens.length,
      successfulSends: results.filter(r => r.success).length,
      results
    };

  } catch (error) {
    console.error('Error sending notification:', error);
    return {
      success: false,
      error: error.message,
      userId
    };
  }
}

/**
 * Build notification payload based on type
 * @param {string} type - Notification type
 * @param {Object} data - Event data
 * @returns {Object} FCM payload
 */
function buildNotificationPayload(type, data) {
  const payloads = {
    [NOTIFICATION_TYPES.NEW_REQUEST]: {
      notification: {
        title: 'New Charging Request',
        body: `${data.userName || 'A user'} needs charging at ${data.location || 'your location'}`
      },
      data: {
        type: NOTIFICATION_TYPES.NEW_REQUEST,
        requestId: data.requestId,
        userId: data.userId,
        location: JSON.stringify(data.location || {}),
        vehicleType: data.vehicleType || '',
        click_action: 'NEW_REQUEST'
      }
    },

    [NOTIFICATION_TYPES.REQUEST_ACCEPTED]: {
      notification: {
        title: 'Request Accepted!',
        body: `${data.hostName || 'Host'} accepted your charging request`
      },
      data: {
        type: NOTIFICATION_TYPES.REQUEST_ACCEPTED,
        requestId: data.requestId,
        hostId: data.hostId,
        responseId: data.responseId,
        price: data.price?.toString() || '0',
        estimatedArrival: data.estimatedArrival?.toString() || '0',
        click_action: 'REQUEST_ACCEPTED'
      }
    },

    [NOTIFICATION_TYPES.USER_ARRIVED]: {
      notification: {
        title: 'User Has Arrived',
        body: 'Your customer has arrived for charging'
      },
      data: {
        type: NOTIFICATION_TYPES.USER_ARRIVED,
        bookingId: data.bookingId,
        userId: data.userId,
        click_action: 'USER_ARRIVED'
      }
    },

    [NOTIFICATION_TYPES.OTP_REQUIRED]: {
      notification: {
        title: 'OTP Required',
        body: 'Enter OTP to start/stop charging session'
      },
      data: {
        type: NOTIFICATION_TYPES.OTP_REQUIRED,
        bookingId: data.bookingId,
        action: data.action, // 'start' or 'stop'
        click_action: 'OTP_REQUIRED'
      }
    },

    [NOTIFICATION_TYPES.SESSION_STARTED]: {
      notification: {
        title: 'Charging Started',
        body: 'Your charging session has begun'
      },
      data: {
        type: NOTIFICATION_TYPES.SESSION_STARTED,
        bookingId: data.bookingId,
        startTime: data.startTime?.toISOString() || '',
        click_action: 'SESSION_STARTED'
      }
    },

    [NOTIFICATION_TYPES.SESSION_STOPPED]: {
      notification: {
        title: 'Charging Complete',
        body: `Session ended. Total: $${data.finalAmount || 0}`
      },
      data: {
        type: NOTIFICATION_TYPES.SESSION_STOPPED,
        bookingId: data.bookingId,
        finalAmount: data.finalAmount?.toString() || '0',
        duration: data.duration?.toString() || '0',
        endTime: data.endTime?.toISOString() || '',
        click_action: 'SESSION_STOPPED'
      }
    }
  };

  return payloads[type] || {
    notification: {
      title: 'EV Charging Update',
      body: 'You have a new update'
    },
    data: {
      type: type,
      ...data,
      click_action: 'DEFAULT'
    }
  };
}

/**
 * Get user's device tokens
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of device tokens
 */
async function getUserDeviceTokens(userId) {
  try {
    if (db) {
      // Firebase mode
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        return userData.deviceTokens || [];
      }
    }
    return [];
  } catch (error) {
    console.error('Error getting user tokens:', error);
    return [];
  }
}

/**
 * Store device token for user
 * @param {string} userId - User ID
 * @param {string} token - FCM token
 * @param {string} deviceId - Device identifier
 * @returns {Promise<Object>} Result
 */
async function storeDeviceToken(userId, token, deviceId) {
  try {
    if (db) {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        const deviceTokens = userData.deviceTokens || [];

        // Check if token already exists
        const existingToken = deviceTokens.find(t => t.token === token);
        if (existingToken) {
          return { success: true, message: 'Token already stored' };
        }

        // Add new token
        deviceTokens.push({
          token,
          deviceId,
          addedAt: new Date(),
          lastUsed: new Date()
        });

        await userRef.update({
          deviceTokens: deviceTokens,
          updatedAt: new Date()
        });
      } else {
        // Create user with token
        await userRef.set({
          userId,
          deviceTokens: [{
            token,
            deviceId,
            addedAt: new Date(),
            lastUsed: new Date()
          }],
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    }

    return { success: true, message: 'Token stored successfully' };
  } catch (error) {
    console.error('Error storing device token:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove invalid device token
 * @param {string} userId - User ID
 * @param {string} invalidToken - Token to remove
 * @returns {Promise<void>}
 */
async function removeInvalidToken(userId, invalidToken) {
  try {
    if (db) {
      const userRef = db.collection('users').doc(userId);
      const userDoc = await userRef.get();

      if (userDoc.exists) {
        const userData = userDoc.data();
        const deviceTokens = userData.deviceTokens || [];

        const updatedTokens = deviceTokens.filter(t => t.token !== invalidToken);

        if (updatedTokens.length !== deviceTokens.length) {
          await userRef.update({
            deviceTokens: updatedTokens,
            updatedAt: new Date()
          });
          console.log(`Removed invalid token for user ${userId}`);
        }
      }
    }
  } catch (error) {
    console.error('Error removing invalid token:', error);
  }
}

/**
 * Send notification for new charging request (to nearby hosts)
 * @param {string} requestId - Request ID
 * @param {Object} requestData - Request data
 * @returns {Promise<Object>} Send results
 */
async function notifyNewRequest(requestId, requestData) {
  try {
    // In a real implementation, you'd find nearby hosts
    // For now, this is a placeholder - you'd need to implement host discovery
    const nearbyHosts = await findNearbyHosts(requestData.location);

    const results = [];
    for (const hostId of nearbyHosts) {
      const result = await sendNotification(hostId, NOTIFICATION_TYPES.NEW_REQUEST, {
        requestId,
        userId: requestData.userId,
        location: requestData.location,
        vehicleType: requestData.vehicleType
      });
      results.push({ hostId, ...result });
    }

    return {
      success: true,
      notifiedHosts: nearbyHosts.length,
      results
    };
  } catch (error) {
    console.error('Error notifying new request:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification when request is accepted
 * @param {string} requestId - Request ID
 * @param {string} userId - User who made the request
 * @param {Object} responseData - Response data
 * @returns {Promise<Object>} Send result
 */
async function notifyRequestAccepted(requestId, userId, responseData) {
  return await sendNotification(userId, NOTIFICATION_TYPES.REQUEST_ACCEPTED, {
    requestId,
    hostId: responseData.hostId,
    responseId: responseData.id,
    price: responseData.price,
    estimatedArrival: responseData.estimatedArrival
  });
}

/**
 * Send notification when user arrives
 * @param {string} bookingId - Booking ID
 * @param {string} hostId - Host ID
 * @returns {Promise<Object>} Send result
 */
async function notifyUserArrived(bookingId, hostId) {
  return await sendNotification(hostId, NOTIFICATION_TYPES.USER_ARRIVED, {
    bookingId
  });
}

/**
 * Send OTP required notification
 * @param {string} bookingId - Booking ID
 * @param {string} userId - User ID
 * @param {string} action - 'start' or 'stop'
 * @returns {Promise<Object>} Send result
 */
async function notifyOTPRequired(bookingId, userId, action) {
  return await sendNotification(userId, NOTIFICATION_TYPES.OTP_REQUIRED, {
    bookingId,
    action
  });
}

/**
 * Send session started notification
 * @param {string} bookingId - Booking ID
 * @param {string} userId - User ID
 * @param {Date} startTime - Session start time
 * @returns {Promise<Object>} Send result
 */
async function notifySessionStarted(bookingId, userId, startTime) {
  return await sendNotification(userId, NOTIFICATION_TYPES.SESSION_STARTED, {
    bookingId,
    startTime
  });
}

/**
 * Send session stopped notification
 * @param {string} bookingId - Booking ID
 * @param {string} userId - User ID
 * @param {Object} sessionData - Session completion data
 * @returns {Promise<Object>} Send result
 */
async function notifySessionStopped(bookingId, userId, sessionData) {
  return await sendNotification(userId, NOTIFICATION_TYPES.SESSION_STOPPED, {
    bookingId,
    finalAmount: sessionData.finalAmount,
    duration: sessionData.duration,
    endTime: sessionData.endTime
  });
}

/**
 * Send payment confirmation required notification
 * @param {string} bookingId - Booking ID
 * @param {string} userId - User ID
 * @param {string} hostId - Host ID
 * @param {number} amount - Payment amount
 * @returns {Promise<Object>} Send results
 */
async function notifyPaymentConfirmationRequired(bookingId, userId, hostId, amount) {
  const userResult = await sendNotification(userId, NOTIFICATION_TYPES.PAYMENT_CONFIRMATION_REQUIRED, {
    bookingId,
    amount,
    role: 'user',
    message: `Please confirm that you paid $${amount} to the host`
  });

  const hostResult = await sendNotification(hostId, NOTIFICATION_TYPES.PAYMENT_CONFIRMATION_REQUIRED, {
    bookingId,
    amount,
    role: 'host',
    message: `Please confirm that you received $${amount} from the user`
  });

  return {
    success: true,
    userNotification: userResult,
    hostNotification: hostResult
  };
}

/**
 * Send payment dispute notification
 * @param {string} bookingId - Booking ID
 * @param {string} userId - User ID
 * @param {string} hostId - Host ID
 * @param {string} reason - Dispute reason
 * @returns {Promise<Object>} Send results
 */
async function notifyPaymentDispute(bookingId, userId, hostId, reason) {
  const userResult = await sendNotification(userId, NOTIFICATION_TYPES.PAYMENT_DISPUTE, {
    bookingId,
    reason,
    message: `Payment dispute: ${reason}. A resolution will be determined automatically.`
  });

  const hostResult = await sendNotification(hostId, NOTIFICATION_TYPES.PAYMENT_DISPUTE, {
    bookingId,
    reason,
    message: `Payment dispute: ${reason}. A resolution will be determined automatically.`
  });

  return {
    success: true,
    userNotification: userResult,
    hostNotification: hostResult
  };
}

/**
 * Send payment resolved notification
 * @param {string} bookingId - Booking ID
 * @param {string} userId - User ID
 * @param {string} hostId - Host ID
 * @param {string} resolution - Resolution type
 * @param {number} amount - Payment amount
 * @param {Object} penalties - Trust score penalties applied
 * @param {string} adminNotes - Admin notes if manually resolved
 * @returns {Promise<Object>} Send results
 */
async function notifyPaymentResolved(bookingId, userId, hostId, resolution, amount, penalties = {}, adminNotes = '') {
  const resolutionMessage = getResolutionMessage(resolution, amount, penalties, adminNotes);

  const userResult = await sendNotification(userId, NOTIFICATION_TYPES.PAYMENT_RESOLVED, {
    bookingId,
    resolution,
    amount,
    penalties: penalties[userId] || 0,
    message: resolutionMessage
  });

  const hostResult = await sendNotification(hostId, NOTIFICATION_TYPES.PAYMENT_RESOLVED, {
    bookingId,
    resolution,
    amount,
    penalties: penalties[hostId] || 0,
    message: resolutionMessage
  });

  return {
    success: true,
    userNotification: userResult,
    hostNotification: hostResult
  };
}

/**
 * Get human-readable resolution message
 * @param {string} resolution - Resolution type
 * @param {number} amount - Payment amount
 * @param {Object} penalties - Applied penalties
 * @param {string} adminNotes - Admin notes
 * @returns {string} Resolution message
 */
function getResolutionMessage(resolution, amount, penalties, adminNotes) {
  switch (resolution) {
    case 'USER_FAULT':
      return `Payment dispute resolved: User found at fault for not paying $${amount}. Trust score penalty applied.`;
    case 'HOST_FAULT':
      return `Payment dispute resolved: Host found at fault for false claim. Trust score penalty applied.`;
    case 'SPLIT':
      return `Payment dispute resolved: Both parties share fault. Trust score penalties applied to both.`;
    case 'NO_FAULT':
      return `Payment dispute resolved: No fault determined. No penalties applied.`;
    case 'confirmed':
      return `Payment confirmed by both parties for $${amount}.`;
    default:
      return `Payment dispute resolved: ${resolution}. ${adminNotes}`;
  }
}

module.exports = {
  sendNotification,
  storeDeviceToken,
  notifyNewRequest,
  notifyRequestAccepted,
  notifyUserArrived,
  notifyOTPRequired,
  notifySessionStarted,
  notifySessionStopped,
  notifyPaymentConfirmationRequired,
  notifyPaymentDispute,
  notifyPaymentResolved,
  NOTIFICATION_TYPES
};