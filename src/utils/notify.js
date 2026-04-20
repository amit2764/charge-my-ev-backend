const { admin, db, mockMode } = require('../lib/firestore');
const logger = require('../lib/logger');

const DEFAULT_NOTIFICATION_PREFS = {
  bookingUpdates: true,
  sessionEvents: true,
  paymentAlerts: true,
  ratings: true,
  promotions: false
};

function safeString(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function maskUserId(userId) {
  const raw = safeString(userId);
  if (!raw) return 'User';
  if (raw.length <= 4) return raw;
  return `User ${raw.slice(-4)}`;
}

function normalizeNotificationPrefs(prefs) {
  const source = { ...DEFAULT_NOTIFICATION_PREFS, ...(prefs || {}) };
  return {
    bookingUpdates: source.bookingUpdates !== false,
    sessionEvents: source.sessionEvents !== false,
    paymentAlerts: true,
    ratings: source.ratings !== false,
    promotions: source.promotions === true
  };
}

function resolveNotificationCategory({ title, body, data }) {
  const explicit = String(data?.notificationCategory || data?.category || data?.type || '').toLowerCase();
  if (explicit === 'bookingupdates' || explicit === 'booking_updates' || explicit === 'booking') return 'bookingUpdates';
  if (explicit === 'sessionevents' || explicit === 'session_events' || explicit === 'session') return 'sessionEvents';
  if (explicit === 'paymentalerts' || explicit === 'payment_alerts' || explicit === 'payment') return 'paymentAlerts';
  if (explicit === 'ratings' || explicit === 'rating') return 'ratings';
  if (explicit === 'promotions' || explicit === 'promotion' || explicit === 'promo') return 'promotions';

  const text = `${safeString(title)} ${safeString(body)} ${safeString(data?.deepLink)}`.toLowerCase();
  if (text.includes('payment') || text.includes('cash received') || text.includes('receipt')) return 'paymentAlerts';
  if (text.includes('rate') || text.includes('rating') || text.includes('feedback')) return 'ratings';
  if (text.includes('promo') || text.includes('offer') || text.includes('discount')) return 'promotions';
  if (text.includes('charging') || text.includes('session')) return 'sessionEvents';
  return 'bookingUpdates';
}

function arePrefsEqual(a, b) {
  return (
    !!a &&
    !!b &&
    a.bookingUpdates === b.bookingUpdates &&
    a.sessionEvents === b.sessionEvents &&
    a.paymentAlerts === b.paymentAlerts &&
    a.ratings === b.ratings &&
    a.promotions === b.promotions
  );
}

async function getUserProfile(userId) {
  if (!db || mockMode || !userId) return null;
  try {
    const snap = await db.collection('users').doc(String(userId)).get();
    if (!snap.exists) return null;
    return snap.data() || null;
  } catch (err) {
    logger.warn('notify.getUserProfile failed', { userId, error: err.message });
    return null;
  }
}

async function getUserDisplayName(userId) {
  const profile = await getUserProfile(userId);
  const name = profile?.name || profile?.displayName || profile?.fullName || null;
  return name ? String(name) : maskUserId(userId);
}

async function sendPushNotification(userId, title, body, data = {}) {
  if (!db || mockMode) return false;

  const targetId = String(userId || '').trim();
  if (!targetId) return false;

  try {
    const userRef = db.collection('users').doc(targetId);
    const snap = await userRef.get();
    if (!snap.exists) {
      logger.warn('notify.skip.noUser', { userId: targetId });
      return false;
    }

    const user = snap.data() || {};

    const currentPrefs = user.notificationPrefs;
    const normalizedPrefs = normalizeNotificationPrefs(currentPrefs);
    if (!arePrefsEqual(currentPrefs, normalizedPrefs)) {
      userRef.set({ notificationPrefs: normalizedPrefs }, { merge: true }).catch(() => {});
    }

    const category = resolveNotificationCategory({ title, body, data });
    if (category !== 'paymentAlerts' && normalizedPrefs[category] === false) {
      logger.info('notify.skip.prefDisabled', { userId: targetId, category });
      return false;
    }

    const token = String(user.fcmToken || '').trim();
    if (!token) {
      logger.warn('notify.skip.noToken', { userId: targetId });
      return false;
    }

    const deepLink = safeString(data.deepLink || '/');
    const stringData = Object.entries({ ...data, deepLink }).reduce((acc, [key, value]) => {
      acc[key] = safeString(value);
      return acc;
    }, {});

    const message = {
      token,
      notification: {
        title: safeString(title),
        body: safeString(body)
      },
      data: stringData,
      webpush: {
        fcmOptions: {
          link: deepLink
        }
      }
    };

    await admin.messaging().send(message);
    return true;
  } catch (err) {
    const code = err?.code || '';
    const unregisterCodes = new Set([
      'messaging/registration-token-not-registered',
      'messaging/invalid-registration-token'
    ]);

    if (unregisterCodes.has(code)) {
      db.collection('users').doc(targetId).set({ fcmToken: null }, { merge: true }).catch(() => {});
    }

    logger.warn('notify.send.failed', { userId: targetId, error: err.message, code });
    return false;
  }
}

module.exports = {
  sendPushNotification,
  getUserDisplayName
};
