import { useEffect, useMemo, useState, useCallback } from 'react';
import api from '../api';

function withinDays(dateIso, days) {
  if (!dateIso) return false;
  if (days === 'all') return true;
  const ms = new Date(dateIso).getTime();
  if (!Number.isFinite(ms)) return false;
  const windowMs = Number(days) * 24 * 60 * 60 * 1000;
  return (Date.now() - ms) <= windowMs;
}

export default function useSessionHistory({ userId, role, pageSize = 20 }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [range, setRange] = useState('30'); // '7' | '30' | 'all'

  const fetchPage = useCallback(async ({ reset = false } = {}) => {
    if (!userId || !role) return;

    if (reset) {
      setRefreshing(true);
      setError('');
    } else if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError('');
    }

    try {
      const effectiveCursor = reset ? '' : (cursor || '');
      const res = await api.get('/api/bookings/history', {
        params: {
          userId,
          role,
          limit: pageSize,
          cursor: effectiveCursor
        }
      });

      const nextItems = Array.isArray(res.data?.items) ? res.data.items : [];
      const nextCursor = res.data?.nextCursor || null;
      const nextHasMore = !!res.data?.hasMore;

      setItems((prev) => reset ? nextItems : [...prev, ...nextItems]);
      setCursor(nextCursor);
      setHasMore(nextHasMore);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load session history');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [userId, role, pageSize, cursor]);

  const refresh = useCallback(async () => {
    setCursor(null);
    setHasMore(false);
    await fetchPage({ reset: true });
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore || refreshing) return;
    await fetchPage({ reset: false });
  }, [hasMore, loading, loadingMore, refreshing, fetchPage]);

  useEffect(() => {
    setItems([]);
    setCursor(null);
    setHasMore(false);
  }, [userId, role]);

  useEffect(() => {
    if (!userId || !role) return;
    void fetchPage({ reset: true });
  }, [userId, role, fetchPage]);

  const filteredItems = useMemo(() => {
    if (range === 'all') return items;
    return items.filter((item) => withinDays(item.date, range));
  }, [items, range]);

  return {
    items: filteredItems,
    rawItems: items,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    range,
    setRange,
    refresh,
    loadMore
  };
}
