import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import app, { db } from '../firebase';
import api from '../api';

// VITE_FCM_VAPID_KEY must be set in .env:
// VITE_FCM_VAPID_KEY=<your_web_push_certificate_key_pair_from_firebase_console>
const VAPID_KEY = import.meta.env.VITE_FCM_VAPID_KEY || '';
const SW_PATH = '/firebase-messaging-sw.js';

let messagingInstance = null;

async function getMessagingInstance() {
  if (messagingInstance) return messagingInstance;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;
  try {
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch {
    return null;
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_PATH);
  } catch (err) {
    console.warn('[FCM] Service worker registration failed:', err.message);
    return null;
  }
}

export async function getFCMToken() {
  if (!VAPID_KEY) {
    return null;
  }

  const messaging = await getMessagingInstance();
  if (!messaging) {
    console.warn('[FCM] FCM not supported in this browser.');
    return null;
  }

  const permission = await Notification.requestPermission().catch(() => 'denied');
  if (permission !== 'granted') {
    console.warn('[FCM] Notification permission not granted:', permission);
    return null;
  }

  const sw = await registerServiceWorker();
  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: sw || undefined
    });
    return token || null;
  } catch (err) {
    console.warn('[FCM] getToken failed:', err.message);
    return null;
  }
}

export async function initFCM(userId) {
  if (!userId) return;

  try {
    const token = await getFCMToken();
    if (!token) return;

    const stored = localStorage.getItem('fcmToken');
    if (stored === token) return;

    await setDoc(doc(db, 'users', userId), { fcmToken: token, fcmUpdatedAt: serverTimestamp() }, { merge: true });
    // Also persist via backend so server-side reads see the latest token
    api.post('/api/auth/fcm-token', { userId, fcmToken: token }).catch(() => {});
    localStorage.setItem('fcmToken', token);
    console.info('[FCM] Token registered for', userId);
  } catch (err) {
    console.warn('[FCM] initFCM error:', err.message);
  }
}

export function onForegroundMessage(callback) {
  let unsubscribe = () => {};

  getMessagingInstance().then((messaging) => {
    if (!messaging) return;
    try {
      const unsub = onMessage(messaging, (payload) => {
        try {
          callback(payload);
        } catch (err) {
          console.warn('[FCM] foreground handler error:', err.message);
        }
      });
      unsubscribe = unsub;
    } catch {
      // messaging not available
    }
  });

  return () => unsubscribe();
}
