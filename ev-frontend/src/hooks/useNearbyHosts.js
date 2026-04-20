import { useEffect, useMemo, useState } from 'react';
import api from '../api';

const DEFAULT_FILTERS = {
  connectorType: '',
  minKw: '',
  maxPrice: ''
};

export default function useNearbyHosts(initialRadiusKm = 5) {
  const [location, setLocation] = useState(null);
  const [radiusKm, setRadiusKm] = useState(initialRadiusKm);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [hosts, setHosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const queryParams = useMemo(() => {
    if (!location) return null;

    const params = new URLSearchParams({
      lat: String(location.lat),
      lng: String(location.lng),
      radiusKm: String(radiusKm)
    });

    if (filters.connectorType) params.set('connectorType', filters.connectorType);
    if (filters.minKw) params.set('minKw', filters.minKw);
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);

    return params.toString();
  }, [location, radiusKm, filters]);

  useEffect(() => {
    let cancelled = false;

    if (!('geolocation' in navigator)) {
      setError('Geolocation is unavailable on this device.');
      return undefined;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        if (cancelled) return;
        setError('Location permission denied. Enable GPS to discover nearby hosts.');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!queryParams) return undefined;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/api/hosts/nearby?${queryParams}`);
        if (cancelled) return;
        const list = Array.isArray(res.data?.hosts) ? res.data.hosts : [];
        setHosts(list);
      } catch (e) {
        if (cancelled) return;
        setError(e.response?.data?.error || e.message || 'Failed to load nearby hosts.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [queryParams]);

  return {
    location,
    radiusKm,
    setRadiusKm,
    filters,
    setFilters,
    hosts,
    loading,
    error,
    refresh: async () => {
      if (!queryParams) return;
      setLoading(true);
      setError('');
      try {
        const res = await api.get(`/api/hosts/nearby?${queryParams}`);
        const list = Array.isArray(res.data?.hosts) ? res.data.hosts : [];
        setHosts(list);
      } catch (e) {
        setError(e.response?.data?.error || e.message || 'Failed to load nearby hosts.');
      } finally {
        setLoading(false);
      }
    }
  };
}
