/**
 * Firebase Cloud Messaging (FCM) Setup for EV Charging App
 * Frontend implementation for push notifications
 */

// frontend/src/utils/fcm.js
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app } from './firebase'; // Your Firebase app instance

// Initialize Firebase Messaging
const messaging = getMessaging(app);

/**
 * Request permission and get FCM token
 * @returns {Promise<string|null>} FCM token or null if denied
 */
export async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY_HERE' // Replace with your VAPID key from Firebase Console
      });

      if (token) {
        // Send token to backend
        await registerDeviceToken(token);
        return token;
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return null;
  }
}

/**
 * Register device token with backend
 * @param {string} token - FCM token
 * @param {string} userId - Current user ID
 * @param {string} deviceId - Unique device identifier
 */
async function registerDeviceToken(token, userId, deviceId = null) {
  try {
    // Generate device ID if not provided
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('deviceId', deviceId);
    }

    const response = await fetch('/api/notifications/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        token,
        deviceId
      })
    });

    const result = await response.json();

    if (result.success) {
      console.log('Device token registered successfully');
      localStorage.setItem('fcmToken', token);
    } else {
      console.error('Failed to register device token:', result.error);
    }
  } catch (error) {
    console.error('Error registering device token:', error);
  }
}

/**
 * Handle incoming messages when app is in foreground
 */
export function setupMessageListener() {
  onMessage(messaging, (payload) => {
    console.log('Message received:', payload);

    // Show browser notification
    if (Notification.permission === 'granted') {
      const notification = new Notification(payload.notification.title, {
        body: payload.notification.body,
        icon: '/icon.png', // Your app icon
        tag: payload.data.type // Prevent duplicate notifications
      });

      // Handle notification click
      notification.onclick = () => {
        handleNotificationClick(payload.data);
        notification.close();
      };
    }

    // Handle the message in your app
    handleNotificationData(payload.data);
  });
}

/**
 * Handle notification data based on type
 * @param {Object} data - Notification data payload
 */
function handleNotificationData(data) {
  switch (data.type) {
    case 'new_request':
      // Navigate to host dashboard or show request details
      console.log('New charging request:', data.requestId);
      // You could dispatch a Redux action or update React state
      break;

    case 'request_accepted':
      // Update UI to show accepted request
      console.log('Request accepted:', data.requestId);
      // Navigate to booking page or update request status
      break;

    case 'user_arrived':
      // Notify host that user has arrived
      console.log('User arrived for booking:', data.bookingId);
      break;

    case 'otp_required':
      // Show OTP input for start/stop charging
      console.log('OTP required for:', data.action, 'booking:', data.bookingId);
      // Open OTP modal or navigate to charging page
      break;

    case 'session_started':
      // Update UI to show charging in progress
      console.log('Charging session started:', data.bookingId);
      break;

    case 'session_stopped':
      // Show completion screen with billing details
      console.log('Charging session completed:', data.bookingId, 'Amount: $' + data.finalAmount);
      break;

    default:
      console.log('Unknown notification type:', data.type);
  }
}

/**
 * Handle notification click (when app is in background)
 * @param {Object} data - Notification data payload
 */
function handleNotificationClick(data) {
  // Navigate to appropriate page based on notification type
  switch (data.click_action) {
    case 'NEW_REQUEST':
      // Navigate to request details page
      window.location.href = `/host/requests/${data.requestId}`;
      break;

    case 'REQUEST_ACCEPTED':
      // Navigate to booking page
      window.location.href = `/user/bookings/${data.bookingId || data.requestId}`;
      break;

    case 'USER_ARRIVED':
      // Navigate to active booking
      window.location.href = `/host/bookings/${data.bookingId}`;
      break;

    case 'OTP_REQUIRED':
      // Navigate to charging page with OTP prompt
      window.location.href = `/charging/${data.bookingId}?action=${data.action}`;
      break;

    case 'SESSION_STARTED':
    case 'SESSION_STOPPED':
      // Navigate to booking details
      window.location.href = `/bookings/${data.bookingId}`;
      break;

    default:
      // Navigate to home/dashboard
      window.location.href = '/dashboard';
  }
}

/**
 * Initialize FCM for a user
 * Call this when user logs in
 * @param {string} userId - Current user ID
 */
export async function initializeFCM(userId) {
  try {
    // Check if we already have a token
    let token = localStorage.getItem('fcmToken');

    if (!token) {
      // Request permission and get token
      token = await requestNotificationPermission();
    }

    if (token) {
      // Register token with backend
      const deviceId = localStorage.getItem('deviceId');
      await registerDeviceToken(token, userId, deviceId);
    }

    // Set up message listener
    setupMessageListener();

  } catch (error) {
    console.error('Error initializing FCM:', error);
  }
}

/**
 * Clean up FCM when user logs out
 */
export function cleanupFCM() {
  // Clear stored tokens
  localStorage.removeItem('fcmToken');
  localStorage.removeItem('deviceId');

  // Note: Firebase handles cleanup automatically
}

/**
 * React Hook for FCM (if using React)
 */
/*
import { useEffect } from 'react';
import { initializeFCM, cleanupFCM } from '../utils/fcm';

function useFCM(userId) {
  useEffect(() => {
    if (userId) {
      initializeFCM(userId);
    }

    return () => {
      cleanupFCM();
    };
  }, [userId]);
}

export default useFCM;
*/