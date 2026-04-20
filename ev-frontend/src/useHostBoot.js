import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { db } from './firebase';
import { resolveBookingState } from './resolveBookingState';

const HOST_BOOT_STATUSES = ['REQUEST', 'BOOKED', 'CONFIRMED', 'STARTED', 'COMPLETED'];

function isValidHostId(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== 'null' && normalized !== 'undefined';
}

export async function fetchActiveBookingForHost(hostId) {
  if (!isValidHostId(hostId)) return null;

  const bookingsRef = collection(db, 'bookings');
  const q = query(
    bookingsRef,
    where('hostId', '==', hostId),
    where('status', 'in', HOST_BOOT_STATUSES),
    orderBy('createdAt', 'desc'),
    limit(10)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const bookings = snap.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
  const active = bookings.find((booking) => resolveBookingState(booking, hostId).screen !== 'HOME');
  return active || null;
}

export function useHostBoot(hostId, { navigateTo, onBooking } = {}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub;
    let disposed = false;

    async function boot() {
      if (!isValidHostId(hostId)) {
        setReady(true);
        return;
      }

      try {
        const booking = await fetchActiveBookingForHost(hostId);
        if (disposed) return;

        if (booking) {
          onBooking?.(booking);
          const resolved = resolveBookingState(booking, hostId);
          navigateTo?.(resolved.screen, resolved);

          unsub = onSnapshot(doc(db, 'bookings', booking.id), (snap) => {
            if (!snap.exists()) return;
            const liveBooking = { id: snap.id, ...snap.data() };
            onBooking?.(liveBooking);
            const r = resolveBookingState(liveBooking, hostId);
            navigateTo?.(r.screen, r);
          });
        }
      } finally {
        if (!disposed) setReady(true);
      }
    }

    boot();
    return () => {
      disposed = true;
      if (typeof unsub === 'function') unsub();
    };
  }, [hostId, navigateTo, onBooking]);

  return ready;
}