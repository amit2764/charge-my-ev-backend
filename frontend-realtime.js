/**
 * Real-Time Updates for EV Charging Frontend
 * Uses Firebase Firestore real-time listeners
 */

import { db } from './firebase'; // Your Firebase client config
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';

/**
 * Real-time listener for host responses to a user's request
 * @param {string} requestId - The charging request ID
 * @param {function} onResponseUpdate - Callback for response updates
 * @returns {function} Unsubscribe function
 */
export function listenToRequestResponses(requestId, onResponseUpdate) {
  const q = query(
    collection(db, 'host_responses'),
    where('requestId', '==', requestId)
  );

  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const response = {
        id: change.doc.id,
        ...change.doc.data()
      };

      onResponseUpdate({
        type: change.type, // 'added', 'modified', 'removed'
        response
      });
    });
  }, (error) => {
    console.error('Error listening to responses:', error);
  });
}

/**
 * Real-time listener for user's bookings
 * @param {string} userId - The user ID
 * @param {function} onBookingUpdate - Callback for booking updates
 * @returns {function} Unsubscribe function
 */
export function listenToUserBookings(userId, onBookingUpdate) {
  const q = query(
    collection(db, 'bookings'),
    where('userId', '==', userId)
  );

  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const booking = {
        id: change.doc.id,
        ...change.doc.data()
      };

      onBookingUpdate({
        type: change.type,
        booking
      });
    });
  }, (error) => {
    console.error('Error listening to bookings:', error);
  });
}

/**
 * Real-time listener for a specific booking (for charging session updates)
 * @param {string} bookingId - The booking ID
 * @param {function} onBookingChange - Callback for booking changes
 * @returns {function} Unsubscribe function
 */
export function listenToBooking(bookingId, onBookingChange) {
  const bookingRef = doc(db, 'bookings', bookingId);

  return onSnapshot(bookingRef, (doc) => {
    if (doc.exists()) {
      const booking = {
        id: doc.id,
        ...doc.data()
      };

      onBookingChange(booking);
    }
  }, (error) => {
    console.error('Error listening to booking:', error);
  });
}

/**
 * Real-time listener for host's responses (for hosts to see their responses)
 * @param {string} hostId - The host user ID
 * @param {function} onResponseUpdate - Callback for response updates
 * @returns {function} Unsubscribe function
 */
export function listenToHostResponses(hostId, onResponseUpdate) {
  const q = query(
    collection(db, 'host_responses'),
    where('hostId', '==', hostId)
  );

  return onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      const response = {
        id: change.doc.id,
        ...change.doc.data()
      };

      onResponseUpdate({
        type: change.type,
        response
      });
    });
  }, (error) => {
    console.error('Error listening to host responses:', error);
  });
}

/**
 * Real-time listener manager for React components
 * Handles subscription lifecycle
 */
export class RealtimeManager {
  constructor() {
    this.subscriptions = new Set();
  }

  /**
   * Add a subscription
   * @param {function} unsubscribe - The unsubscribe function
   */
  addSubscription(unsubscribe) {
    this.subscriptions.add(unsubscribe);
  }

  /**
   * Remove a specific subscription
   * @param {function} unsubscribe - The unsubscribe function to remove
   */
  removeSubscription(unsubscribe) {
    if (this.subscriptions.has(unsubscribe)) {
      unsubscribe();
      this.subscriptions.delete(unsubscribe);
    }
  }

  /**
   * Clear all subscriptions
   */
  cleanup() {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions.clear();
  }
}

/**
 * React Hook for real-time updates (if using React)
 * Example usage in a component
 */
/*
import { useEffect, useState } from 'react';
import { listenToRequestResponses, listenToUserBookings } from './realtime';

function RequestMatchingPage({ requestId, userId }) {
  const [responses, setResponses] = useState([]);
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    // Listen for responses to this request
    const unsubscribeResponses = listenToRequestResponses(requestId, (update) => {
      if (update.type === 'added') {
        setResponses(prev => [...prev, update.response]);
      } else if (update.type === 'modified') {
        setResponses(prev => prev.map(r =>
          r.id === update.response.id ? update.response : r
        ));
      }
    });

    // Listen for user's bookings
    const unsubscribeBookings = listenToUserBookings(userId, (update) => {
      if (update.type === 'added') {
        setBookings(prev => [...prev, update.booking]);
      } else if (update.type === 'modified') {
        setBookings(prev => prev.map(b =>
          b.id === update.booking.id ? update.booking : b
        ));
      }
    });

    return () => {
      unsubscribeResponses();
      unsubscribeBookings();
    };
  }, [requestId, userId]);

  return (
    <div>
      <h2>Host Responses</h2>
      {responses.map(response => (
        <div key={response.id}>
          Status: {response.status}, Price: ${response.price}
        </div>
      ))}

      <h2>Your Bookings</h2>
      {bookings.map(booking => (
        <div key={booking.id}>
          Status: {booking.status}, Price: ${booking.price}
        </div>
      ))}
    </div>
  );
}
*/