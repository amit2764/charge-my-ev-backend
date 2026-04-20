import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useStore } from '../store';
import { Card } from '../components';
import NotificationPrefRow from '../components/NotificationPrefRow';

const DEFAULT_NOTIFICATION_PREFS = {
  bookingUpdates: true,
  sessionEvents: true,
  paymentAlerts: true,
  ratings: true,
  promotions: false
};

function normalizePrefs(prefs) {
  const incoming = prefs || {};
  return {
    bookingUpdates: incoming.bookingUpdates !== false,
    sessionEvents: incoming.sessionEvents !== false,
    paymentAlerts: true,
    ratings: incoming.ratings !== false,
    promotions: incoming.promotions === true
  };
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

export default function SettingsScreen() {
  const { user } = useStore();
  const [prefs, setPrefs] = useState(DEFAULT_NOTIFICATION_PREFS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const userRef = useMemo(() => {
    if (!user) return null;
    return doc(db, 'users', String(user));
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const loadPrefs = async () => {
      if (!userRef) return;
      setLoading(true);
      setError('');
      try {
        const snap = await getDoc(userRef);
        const data = snap.exists() ? (snap.data() || {}) : {};
        const normalized = normalizePrefs(data.notificationPrefs);
        if (!cancelled) {
          setPrefs(normalized);
        }

        if (!arePrefsEqual(data.notificationPrefs, normalized)) {
          await setDoc(userRef, { notificationPrefs: normalized }, { merge: true });
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to load notification preferences.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPrefs();
    return () => {
      cancelled = true;
    };
  }, [userRef]);

  const updatePref = async (key, nextValue) => {
    if (!userRef) return;
    if (key === 'paymentAlerts') return;

    const previousPrefs = prefs;
    const nextPrefs = {
      ...previousPrefs,
      [key]: !!nextValue,
      paymentAlerts: true
    };

    setPrefs(nextPrefs);
    setError('');

    try {
      await setDoc(userRef, { notificationPrefs: nextPrefs }, { merge: true });
    } catch (err) {
      setPrefs(previousPrefs);
      setError('Failed to save preference. Please try again.');
    }
  };

  return (
    <div className="p-4 pb-28 space-y-4">
      <h2 className="text-2xl font-bold text-white">Settings</h2>

      <Card>
        <h3 className="mb-3 text-base font-bold text-cyan-300">Notification preferences</h3>
        {error ? <p className="mb-3 text-sm text-red-400">{error}</p> : null}

        <div className="space-y-2">
          <NotificationPrefRow
            label="Booking updates"
            description="Request accepted, booking confirmed, and booking status changes"
            checked={prefs.bookingUpdates}
            loading={loading}
            onChange={(value) => updatePref('bookingUpdates', value)}
          />

          <NotificationPrefRow
            label="Session events"
            description="Charging started/stopped and live session events"
            checked={prefs.sessionEvents}
            loading={loading}
            onChange={(value) => updatePref('sessionEvents', value)}
          />

          <NotificationPrefRow
            label="Payment alerts"
            description="Always on for critical payment safety notifications"
            checked={true}
            disabled={true}
            loading={false}
            onChange={() => {}}
          />

          <NotificationPrefRow
            label="Ratings"
            description="Rate reminders and feedback-related notifications"
            checked={prefs.ratings}
            loading={loading}
            onChange={(value) => updatePref('ratings', value)}
          />

          <NotificationPrefRow
            label="Promotions"
            description="Offers, promo campaigns, and non-critical announcements"
            checked={prefs.promotions}
            loading={loading}
            onChange={(value) => updatePref('promotions', value)}
          />
        </div>
      </Card>
    </div>
  );
}
