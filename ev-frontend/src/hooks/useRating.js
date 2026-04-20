import { useState, useEffect, useCallback } from 'react';
import api from '../api';

export default function useRating(bookingId, fromUserId) {
  const [alreadyRated, setAlreadyRated] = useState(null); // null = still loading
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!bookingId || !fromUserId) {
      setAlreadyRated(false);
      return;
    }

    let cancelled = false;
    api.get(`/api/ratings/booking/${encodeURIComponent(bookingId)}?userId=${encodeURIComponent(fromUserId)}`)
      .then((res) => {
        if (!cancelled) setAlreadyRated(res.data?.rated === true);
      })
      .catch(() => {
        if (!cancelled) setAlreadyRated(false);
      });

    return () => { cancelled = true; };
  }, [bookingId, fromUserId]);

  const submitRating = useCallback(async ({ toUserId, role, stars, comment }) => {
    setSubmitting(true);
    try {
      await api.post('/api/ratings', {
        bookingId,
        fromUserId,
        toUserId,
        role,
        stars: stars !== undefined && stars !== null ? stars : null,
        comment: String(comment || '').slice(0, 200)
      });
      setDone(true);
      setAlreadyRated(true);
    } catch (err) {
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [bookingId, fromUserId]);

  return { alreadyRated, submitting, done, submitRating };
}
