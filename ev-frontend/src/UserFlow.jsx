import { useState, useEffect, useCallback } from 'react';
import api from './api';
import { socket } from './socket';
import { useStore } from './store';
import { Button, Card, Input } from './components';
import PaymentScreen from './PaymentScreen';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { resolveBookingState } from './resolveBookingState';
import useChat from './hooks/useChat';
import ChatScreen from './screens/ChatScreen';
import RatingScreen from './screens/RatingScreen';
import './FlowVisuals.css';
import PromoCodeInput from './components/PromoCodeInput';
import usePromoCode from './hooks/usePromoCode';
import VerifiedBadge from './components/VerifiedBadge';

const FLOW_STEPS = ['Request', 'PIN', 'Charging', 'Payment', 'Done'];
const UI_REFRESH_TAG = 'UI Refresh 2026-04-21';

function readPendingPaymentBookingId() {
  try {
    return localStorage.getItem('pendingPaymentBookingId') || null;
  } catch {
    return null;
  }
}

function writePendingPaymentBookingId(bookingId) {
  if (!bookingId) return;
  try {
    localStorage.setItem('pendingPaymentBookingId', bookingId);
  } catch {
    // Ignore storage write failures so UI does not crash in restricted browsers.
  }
}

function clearPendingPaymentBookingId() {
  try {
    localStorage.removeItem('pendingPaymentBookingId');
  } catch {
    // Ignore storage cleanup failures.
  }
}

function readDiscoveryPrefillHost() {
  try {
    const raw = localStorage.getItem('discoveryPrefillHost');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearDiscoveryPrefillHost() {
  try {
    localStorage.removeItem('discoveryPrefillHost');
  } catch {
    // Ignore storage cleanup failures.
  }
}

function isPendingPaymentStatus(paymentStatus) {
  return ['PENDING', 'USER_CONFIRMED', 'HOST_CONFIRMED'].includes(String(paymentStatus || 'PENDING').toUpperCase());
}

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getFlowIndex(step, booking) {
  if (step === 'RATING') return 4;
  if (step === 'PAYMENT') return 3;
  if (step === 'CHARGING' && booking?.status === 'STARTED') return 2;
  if (step === 'CHARGING') return 1;
  return 0;
}

function isValidUserId(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== 'null' && normalized !== 'undefined';
}

function canRenderUserBooking(booking, userId, bookingRole) {
  if (!booking) return false;
  if (bookingRole && bookingRole !== 'user') return false;
  if (booking.userId && userId) return booking.userId === userId;
  return true;
}

export default function UserFlow() {
  const { user, userProfile, activeRequest, setActiveRequest, activeBooking, activeBookingRole, setActiveBooking, setBookingStep } = useStore();
  const [step, setStep] = useState('REQUEST'); // REQUEST, MATCHING, CONFIRM, CHARGING, PAYMENT, RATING
  const [hosts, setHosts] = useState([]);
  const [selectedHost, setSelectedHost] = useState(null);
  const [acceptedHost, setAcceptedHost] = useState(null); // { hostId, expiresInSeconds, price, estimatedArrival }
  const [acceptanceCountdown, setAcceptanceCountdown] = useState(0);
  const [hostVerificationMap, setHostVerificationMap] = useState({});
  
  // Live Charging Timer State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [hostOnline, setHostOnline] = useState(true);
  const [preferredHostId, setPreferredHostId] = useState(null);
  const [promoCode, setPromoCode] = useState('');
  const { validating, error: promoError, discount, appliedCode, validateCode } = usePromoCode();
  const canRenderActiveBooking = canRenderUserBooking(activeBooking, user, activeBookingRole);
  const flowIndex = getFlowIndex(step, canRenderActiveBooking ? activeBooking : null);
  const hasValidUser = isValidUserId(user);
  const { unreadCount } = useChat(activeBooking, user);

  const chatEnabledStatuses = new Set(['BOOKED', 'CONFIRMED', 'STARTED']);
  const canOpenChat = canRenderActiveBooking && !!activeBooking?.id && chatEnabledStatuses.has(String(activeBooking?.status || '').toUpperCase());

  const getCurrentRequestId = () => useStore.getState().activeRequest?.id || null;

  const mapResolvedScreenToStep = useCallback((screen) => {
    if (screen === 'MATCHING') return 'MATCHING';
    if (screen === 'CONFIRM') return 'CONFIRM';
    if (screen === 'CHARGING_WAIT' || screen === 'CHARGING_RUN') return 'CHARGING';
    if (screen === 'PAYMENT' || screen === 'PAYMENT_EXPIRED' || screen === 'SUPPORT') return 'PAYMENT';
    if (screen === 'RATING') return 'RATING';
    return 'REQUEST';
  }, []);

  const applyBookingResolution = useCallback((bookingDoc, options = {}) => {
    const { preserveInFlightRequest = false } = options;
    const result = resolveBookingState(bookingDoc, user);

    if (!bookingDoc && preserveInFlightRequest && activeRequest?.id && (step === 'MATCHING' || step === 'CONFIRM')) {
      setBookingStep('REQUEST');
      return result;
    }

    const nextStep = mapResolvedScreenToStep(result.screen);
    if (step !== nextStep) {
      setStep(nextStep);
    }

    if (bookingDoc?.id) {
      const paymentStatus = String(
        bookingDoc?.payment?.status || bookingDoc?.paymentStatus || 'PENDING'
      ).toUpperCase();
      if (isPendingPaymentStatus(paymentStatus)) {
        writePendingPaymentBookingId(bookingDoc.id);
      }
      if (paymentStatus === 'CONFIRMED') {
        clearPendingPaymentBookingId();
      }
      setBookingStep(String(bookingDoc.status || 'REQUEST').toUpperCase());
    } else {
      setBookingStep('REQUEST');
    }

    return result;
  }, [user, activeRequest?.id, step, mapResolvedScreenToStep, setBookingStep]);

  const syncStateFromBackend = useCallback(async () => {
    if (!hasValidUser) return;
    const pendingPaymentBookingId = readPendingPaymentBookingId();

    try {
      if (pendingPaymentBookingId) {
        try {
          const pendingRes = await api.get(`/api/payment/${pendingPaymentBookingId}/status`);
          const pendingStatus = String(pendingRes.data?.paymentStatus || 'PENDING').toUpperCase();
          if (pendingStatus === 'CONFIRMED') {
            clearPendingPaymentBookingId();
          }
        } catch {
          // Ignore lookup errors; active booking query below remains authoritative.
        }
      }

      const res = await api.get(`/api/bookings/active?userId=${encodeURIComponent(user)}&role=user`);
      const booking = res.data?.booking || null;

      if (!booking) {
        if (activeBooking?.userId === user) {
          setActiveBooking(null, 'user');
        }
        applyBookingResolution(null, { preserveInFlightRequest: true });
        return;
      }

      const localBooking = useStore.getState().activeBooking;
      const changed = !localBooking ||
        localBooking.id !== booking.id ||
        localBooking.status !== booking.status ||
        localBooking.paymentStatus !== booking.paymentStatus ||
        localBooking.chargingMode !== booking.chargingMode;

      if (changed) {
        setActiveBooking(booking, 'user');
      }
      if (
        String(booking.status || '').toUpperCase() === 'COMPLETED' &&
        isPendingPaymentStatus(String(booking.paymentStatus || 'PENDING').toUpperCase()) &&
        pendingPaymentBookingId === booking.id &&
        step === 'REQUEST'
      ) {
        setBookingStep(String(booking.status || 'REQUEST').toUpperCase());
        return;
      }

      applyBookingResolution(booking, { preserveInFlightRequest: true });
    } catch {
      // Keep current screen and retry on next trigger.
    }
  }, [user, hasValidUser, activeBooking?.userId, setActiveBooking, setBookingStep, step, applyBookingResolution]);

  const syncRequestStateFromBackend = useCallback(async (requestId = getCurrentRequestId()) => {
    if (!hasValidUser || !requestId) return;

    try {
      const res = await api.get(`/api/requests/${encodeURIComponent(requestId)}/responses`);
      const request = res.data?.request || null;
      const responses = Array.isArray(res.data?.responses) ? res.data.responses : [];

      setHosts(responses);

      if (request?.acceptedBy && request?.acceptanceExpiresAt) {
        const expiresAt = new Date(request.acceptanceExpiresAt).getTime();
        const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
        const acceptedResponse = responses.find((entry) => entry.hostId === request.acceptedBy) || null;
        if (remaining > 0) {
          setAcceptedHost({
            hostId: request.acceptedBy,
            requestId,
            expiresInSeconds: remaining,
            price: acceptedResponse?.price,
            estimatedArrival: acceptedResponse?.estimatedArrival
          });
          setAcceptanceCountdown(remaining);
        } else {
          setAcceptedHost(null);
          setAcceptanceCountdown(0);
        }
      }

      if (preferredHostId) {
        const preferredResponse = responses.find((entry) => entry.hostId === preferredHostId);
        if (preferredResponse) {
          setSelectedHost(preferredResponse);
          setStep('CONFIRM');
          setPreferredHostId(null);
        }
      }
    } catch {
      // Best-effort fallback after reconnect or request creation.
    }
  }, [hasValidUser, preferredHostId]);

  // Acceptance countdown timer (30 seconds for user to confirm)
  useEffect(() => {
    let interval;
    if (acceptedHost && acceptanceCountdown > 0) {
      interval = setInterval(() => {
        setAcceptanceCountdown(prev => {
          if (prev <= 1) {
            setAcceptedHost(null); // Request expires, back to finding hosts
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [acceptedHost, acceptanceCountdown]);

  useEffect(() => {
    if (!activeRequest?.id) return;
    const createdAt = new Date(activeRequest.createdAt || 0).getTime();
    if (!Number.isFinite(createdAt)) return;

    const staleMs = 5 * 60 * 1000;
    if (Date.now() - createdAt > staleMs) {
      setActiveRequest(null);
      setHosts([]);
      setSelectedHost(null);
      setAcceptedHost(null);
      setAcceptanceCountdown(0);
      if (step !== 'REQUEST') setStep('REQUEST');
    }
  }, [activeRequest?.id, activeRequest?.createdAt, setActiveRequest, step]);

  useEffect(() => {
    let cancelled = false;

    const ids = [...new Set((hosts || []).map((host) => String(host?.hostId || '').trim()).filter(Boolean))];
    if (ids.length === 0) {
      setHostVerificationMap({});
      return undefined;
    }

    const fetchHostVerification = async () => {
      const pairs = await Promise.all(ids.map(async (hostId) => {
        try {
          const res = await api.get(`/api/kyc/status?userId=${encodeURIComponent(hostId)}`);
          const status = String(res.data?.kyc?.status || 'UNVERIFIED').toUpperCase();
          return [hostId, status === 'VERIFIED'];
        } catch {
          return [hostId, false];
        }
      }));

      if (cancelled) return;
      const nextMap = {};
      pairs.forEach(([hostId, verified]) => {
        nextMap[hostId] = verified;
      });
      setHostVerificationMap(nextMap);
    };

    fetchHostVerification();
    return () => {
      cancelled = true;
    };
  }, [hosts]);

  // Live Charging Timer Effect
  useEffect(() => {
    let interval;
    if (step === 'CHARGING' && activeBooking?.status === 'STARTED' && activeBooking?.startTime) {
      interval = setInterval(() => {
        const start = new Date(activeBooking.startTime).getTime();
        setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, activeBooking]);

  useEffect(() => {
    if (step !== 'CHARGING' || activeBooking?.status !== 'STARTED' || !activeBooking?.id) {
      setHostOnline(true);
      return undefined;
    }

    let cancelled = false;

    const checkHostPresence = async () => {
      try {
        const res = await api.get(`/api/session/${activeBooking.id}/presence`);
        if (cancelled) return;
        setHostOnline(!!res.data?.hostOnline);
      } catch {
        if (cancelled) return;
        setHostOnline(true);
      }
    };

    checkHostPresence();
    const interval = setInterval(checkHostPresence, 8000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [step, activeBooking?.id, activeBooking?.status]);

  useEffect(() => {
    if (!hasValidUser) return undefined;

    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [hasValidUser]);

  useEffect(() => {
    if (!hasValidUser || !socket.connected) return;

    socket.emit('subscribe', {
      userId: user,
      requestId: activeRequest?.id || undefined
    });
  }, [user, hasValidUser, activeRequest?.id]);

  useEffect(() => {
    if (!hasValidUser) return undefined;

    const onSocketConnect = () => {
      socket.emit('subscribe', {
        userId: user,
        requestId: activeRequest?.id || undefined
      });
      syncStateFromBackend();
      if (activeRequest?.id) {
        syncRequestStateFromBackend(activeRequest.id);
      }
    };

    const onResponseUpdate = (data) => {
      const currentRequestId = getCurrentRequestId();
      if (!currentRequestId || data?.response?.requestId !== currentRequestId) return;

      if (data.action === 'added' || data.action === 'modified') {
        setHosts(prev => {
          const exists = prev.find(h => h.id === data.response.id);
          return exists ? prev.map(h => h.id === data.response.id ? data.response : h) : [...prev, data.response];
        });

        if (preferredHostId && data.response?.hostId === preferredHostId) {
          setSelectedHost(data.response);
          setStep('CONFIRM');
          setPreferredHostId(null);
        }
      }
    };

    // Listen to request_accepted event (first host accepted = Uber-style lock)
    const onRequestAccepted = (data) => {
      const currentRequestId = getCurrentRequestId();
      if (!currentRequestId || data?.requestId !== currentRequestId) return;

      setAcceptedHost({
        hostId: data.hostId,
        requestId: data.requestId,
        expiresInSeconds: 30,
        price: data.price,
        estimatedArrival: data.estimatedArrival
      });
      setAcceptanceCountdown(30);
    };

    // Host verified the start PIN → session started, get stopPin
    const onSessionStarted = ({ booking }) => {
      if (!booking || booking.userId !== user) return;
      setActiveBooking(booking, 'user');
      applyBookingResolution(booking);
    };

    // Host verified the stop PIN → session completed
    const onSessionStopped = ({ booking, finalAmount }) => {
      if (!booking || booking.userId !== user) return;
      const nextBooking = {
        ...booking,
        finalAmount,
        paymentStatus: booking.paymentStatus || 'PENDING',
        payment: booking.payment || { userConfirmed: false, hostConfirmed: false, status: 'PENDING' }
      };
      setActiveBooking(nextBooking, 'user');
      applyBookingResolution(nextBooking);
    };

    const onPaymentUpdate = ({ bookingId, paymentStatus, payment }) => {
      const currentBooking = useStore.getState().activeBooking;
      if (!currentBooking || currentBooking.id !== bookingId) {
        return;
      }

      const nextBooking = {
        ...currentBooking,
        paymentStatus,
        payment: payment || currentBooking.payment
      };

      setActiveBooking(nextBooking, 'user');
      applyBookingResolution(nextBooking);
    };

    const onModeChanged = ({ bookingId, mode }) => {
      const currentBooking = useStore.getState().activeBooking;
      if (!currentBooking || currentBooking.id !== bookingId) return;
      const nextBooking = { ...currentBooking, chargingMode: mode };
      setActiveBooking(nextBooking, 'user');
      applyBookingResolution(nextBooking);
    };

    socket.on('response_update', onResponseUpdate);
    socket.on('request_accepted', onRequestAccepted);
    socket.on('session_started', onSessionStarted);
    socket.on('session_stopped', onSessionStopped);
    socket.on('payment_update', onPaymentUpdate);
    socket.on('mode_changed', onModeChanged);
    socket.on('connect', onSocketConnect);

    return () => {
      socket.off('response_update', onResponseUpdate);
      socket.off('request_accepted', onRequestAccepted);
      socket.off('session_started', onSessionStarted);
      socket.off('session_stopped', onSessionStopped);
      socket.off('payment_update', onPaymentUpdate);
      socket.off('mode_changed', onModeChanged);
      socket.off('connect', onSocketConnect);
    };
  }, [user, hasValidUser, activeRequest?.id, preferredHostId, setActiveBooking, syncStateFromBackend, syncRequestStateFromBackend, applyBookingResolution]);

  useEffect(() => {
    syncStateFromBackend();
    if (activeRequest?.id) {
      syncRequestStateFromBackend(activeRequest.id);
    }
  }, [activeRequest?.id, syncStateFromBackend, syncRequestStateFromBackend]);

  useEffect(() => {
    const prefillHost = readDiscoveryPrefillHost();
    if (!prefillHost?.chargerId || !hasValidUser || activeRequest?.id || activeBooking?.id) return;

    clearDiscoveryPrefillHost();
    setPreferredHostId(prefillHost.hostId || null);
    setError(prefillHost.name ? `Connecting you to ${prefillHost.name}...` : 'Connecting you to selected host...');
    handleSearchHosts(prefillHost);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasValidUser, activeRequest?.id, activeBooking?.id]);

  useEffect(() => {
    const onFocus = () => syncStateFromBackend();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncStateFromBackend();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = setInterval(syncStateFromBackend, 12000);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(interval);
    };
  }, [syncStateFromBackend]);

  useEffect(() => {
    if (!activeBooking?.id || !user) return undefined;

    const bookingRef = doc(db, 'bookings', activeBooking.id);
    const unsubscribe = onSnapshot(
      bookingRef,
      (snap) => {
        if (!snap.exists()) return;
        const booking = { id: snap.id, ...snap.data() };
        if (booking.userId && booking.userId !== user) return;

        setActiveBooking(booking, 'user');
        applyBookingResolution(booking);
      },
      () => {
        // Firestore listener is best-effort; API sync remains authoritative fallback.
      }
    );

    return () => unsubscribe();
  }, [activeBooking?.id, user, setActiveBooking, applyBookingResolution]);

  // Fallback sync for payment state in case socket event is missed.
  useEffect(() => {
    if (step !== 'PAYMENT' || !activeBooking?.id || activeBooking?.paymentStatus === 'CONFIRMED') {
      return undefined;
    }

    let cancelled = false;

    const pollPaymentStatus = async () => {
      try {
        const res = await api.get(`/api/payment/${activeBooking.id}/status`);
        if (cancelled) return;
        const paymentStatus = res.data?.paymentStatus;
        const payment = res.data?.payment;
        if (!paymentStatus) return;

        const currentBooking = useStore.getState().activeBooking;
        if (!currentBooking || currentBooking.id !== activeBooking.id) return;

        const nextBooking = {
          ...currentBooking,
          paymentStatus,
          payment: payment || currentBooking.payment
        };

        setActiveBooking(nextBooking, 'user');
        applyBookingResolution(nextBooking);
      } catch {
        // Silent retry from next interval.
      }
    };

    pollPaymentStatus();
    const interval = setInterval(pollPaymentStatus, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [step, activeBooking?.id, activeBooking?.paymentStatus, setActiveBooking, applyBookingResolution]);

  const handleSearchHosts = (prefillHost = null) => {
    if (!hasValidUser) {
      setError('Your login session is invalid. Please log in again.');
      return;
    }
    setLoading(true); setError('');
    if (prefillHost?.location) {
      createRequest(prefillHost.location, {
        chargerId: prefillHost.chargerId || null,
        preferredHost: prefillHost
      });
      return;
    }
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => createRequest({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
          console.warn('GPS failed, using profile fallback.', err);
          createRequest(userProfile?.location || { lat: 37.77, lng: -122.41 }); // Fallback
        }
      );
    } else {
      createRequest(userProfile?.location || { lat: 37.77, lng: -122.41 });
    }
  };

  const createRequest = async (location, options = {}) => {
    if (!hasValidUser) {
      setError('Your login session is invalid. Please log in again.');
      setLoading(false);
      return;
    }

    const { chargerId = null, preferredHost = null } = options;

    try {
      setSelectedHost(null);
      setAcceptedHost(null);
      setAcceptanceCountdown(0);
      setHosts([]);
      setPreferredHostId(preferredHost?.hostId || null);

      const res = await api.post('/api/request', { 
        userId: user, 
        location, 
        vehicleType: userProfile?.vehicleType || 'electric',
        promoCode: appliedCode || null,
        chargerId
      });
      setActiveRequest(res.data.request);
      socket.emit('subscribe', { userId: user, requestId: res.data.request.id });
      setStep('MATCHING');
      await syncRequestStateFromBackend(res.data.request.id);
      await syncStateFromBackend();
    } catch (err) { 
      setError('Failed to create request: ' + (err.response?.data?.error || err.message)); 
    } finally {
      setLoading(false);
    }
  };

  const selectHost = (host) => {
    if (!activeRequest?.id || host?.requestId !== activeRequest.id) {
      setError('This host offer is stale. Please wait for fresh offers.');
      setSelectedHost(null);
      setStep('MATCHING');
      return;
    }

    setSelectedHost(host);
    setError('');
    setStep('CONFIRM');
  };

  const confirmBooking = async () => {
    if (!selectedHost?.hostId || !activeRequest?.id) {
      setError('Host offer is no longer valid. Please select a host again.');
      setStep('MATCHING');
      return;
    }

    setLoading(true); setError('');
    try {
      const res = await api.post('/api/book', { userId: user, hostId: selectedHost.hostId, chargerId: 'charger_auto', price: selectedHost.price, requestId: activeRequest.id });
      setActiveBooking(res.data.booking, 'user');
      applyBookingResolution(res.data.booking);
      await syncStateFromBackend();
    } catch (err) { 
      const errorMsg = err.response?.data?.error || err.message;
      if (String(errorMsg).includes('no active offer for this request')) {
        setSelectedHost(null);
        setAcceptedHost(null);
        setAcceptanceCountdown(0);
        setHosts([]);
        setStep('MATCHING');
        setError('That host offer just expired. Waiting for fresh offers...');
      } else {
        setError('Booking failed: ' + errorMsg);
      }
    } finally { setLoading(false); }
  };

  const confirmPayment = async (bookingId, role) => {
    if (!bookingId) {
      setError('No active booking found for payment.');
      setStep('REQUEST');
      return;
    }

    setLoading(true); setError('');
    try {
      const res = await api.post(`/api/bookings/${bookingId}/payment-confirm`, { role });
      if (res.data?.booking) {
        setActiveBooking(res.data.booking, 'user');
        applyBookingResolution(res.data.booking);
      }
      await syncStateFromBackend();
    } catch (err) {
      setError('Payment failed: ' + (err.response?.data?.error || err.message));
    } finally { setLoading(false); }
  };

  const emergencyStop = async () => {
    if (!activeBooking?.id) {
      setError('No running session found to stop.');
      return;
    }

    if (!window.confirm('Stop the session immediately without a PIN? This cannot be undone.')) return;
    setLoading(true); setError('');
    try {
      let res;
      try {
        res = await api.post('/api/session/emergency-stop', { bookingId: activeBooking.id, userId: user });
      } catch (primaryErr) {
        // Backward compatibility: older backend exposes only /api/stop with stopPin.
        if (primaryErr?.response?.status === 404 && activeBooking?.stopPin) {
          res = await api.post('/api/stop', { bookingId: activeBooking.id, otp: activeBooking.stopPin });
        } else {
          throw primaryErr;
        }
      }
      if (res.data?.booking) {
        const nextBooking = { ...res.data.booking, finalAmount: res.data.finalAmount };
        setActiveBooking(nextBooking, 'user');
        applyBookingResolution(nextBooking);
      }
      await syncStateFromBackend();
    } catch (err) {
      setError('Emergency stop failed: ' + (err.response?.data?.error || err.message));
    } finally { setLoading(false); }
  };

  const changeMode = async (mode) => {
    if (!activeBooking?.id) {
      setError('No running session found for mode change.');
      return;
    }

    if (activeBooking?.chargingMode === mode) return;
    setLoading(true); setError('');
    try {
      await api.post('/api/session/mode', { bookingId: activeBooking.id, userId: user, mode });
      const nextBooking = activeBooking ? { ...activeBooking, chargingMode: mode } : null;
      setActiveBooking(nextBooking, 'user');
      applyBookingResolution(nextBooking);
      await syncStateFromBackend();
    } catch (err) {
      setError('Mode change failed: ' + (err.response?.data?.error || err.message));
    } finally { setLoading(false); }
  };

  // Formatting helpers
  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };
  const bookingPrice = toFiniteNumber(activeBooking?.price, 0);
  const runningCost = bookingPrice > 0 ? ((elapsedSeconds / 3600) * bookingPrice).toFixed(2) : '0.00';
  return (
    <div className="flow-shell p-4 pb-6 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Peer charging</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">Charge on demand</h1>
          <p className="mt-1 text-sm text-slate-400">Tesla-grade clarity for finding, matching, charging, and settling in one flow.</p>
        </div>
        <div className="glass-surface hidden rounded-[20px] px-4 py-3 md:block">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Status</p>
          <p className="mt-1 text-sm font-semibold text-cyan-300">{step}</p>
        </div>
      </div>

      {error && <div className="glass-surface mb-4 rounded-[20px] border border-red-500/20 bg-red-900/20 p-3 text-sm text-red-300 animate-pulse">{error}</div>}

      <div className="flow-rail">
        {FLOW_STEPS.map((label, index) => (
          <div
            key={label}
            className={`flow-pill ${index < flowIndex ? 'done' : ''} ${index === flowIndex ? 'active' : ''}`}
          >
            {label}
          </div>
        ))}
      </div>

      {step === 'REQUEST' && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[28px] border border-cyan-400/35 bg-gradient-to-br from-cyan-500/18 via-blue-500/12 to-slate-900/70 p-5 shadow-[0_20px_60px_rgba(34,211,238,0.18)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">Screen 1</p>
                <h2 className="mt-1 text-3xl font-black tracking-[-0.03em] text-white">Request Charge</h2>
                <p className="mt-3 max-w-sm text-sm text-cyan-50/85">Find a nearby host with live pricing, verified identity badges, and minimal waiting time.</p>
              </div>
              <span className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-100">
                {UI_REFRESH_TAG}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="floating-chip"><span className="live-dot" /> Auto locate</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100">Fastest first-match routing</span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100">Realtime availability scan</span>
            </div>
          </div>
          {activeBooking?.status === 'COMPLETED' && isPendingPaymentStatus(activeBooking?.paymentStatus) && (
            <Card className="border border-amber-700 bg-amber-900/20">
              <p className="text-sm text-amber-300">You have a pending payment from your last session.</p>
              <Button className="mt-3" onClick={() => setStep('PAYMENT')}>Resume Payment</Button>
            </Card>
          )}
          <Card className="overflow-hidden border border-cyan-500/20 bg-slate-950/70">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Smart request</p>
                <h3 className="mt-1 text-lg font-bold text-white">Instant trip setup</h3>
              </div>
              <div className="rounded-[18px] border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-right">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Vehicle</p>
                <p className="text-sm font-bold text-cyan-300">EV Ready</p>
              </div>
            </div>
            <Input label="Vehicle Type" value={userProfile?.vehicleType || 'Electric Sedan'} disabled />
            <Button onClick={handleSearchHosts} disabled={loading}>{loading ? 'Scanning Nearby Hosts...' : 'Start Smart Search'}</Button>
            <PromoCodeInput
              code={promoCode}
              onCodeChange={setPromoCode}
              onValidate={validateCode}
              validating={validating}
              error={promoError}
              discount={discount}
              appliedCode={appliedCode}
            />
          </Card>
        </div>
      )}

      {step === 'MATCHING' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Screen 2</p>
              <h2 className="text-2xl font-black text-white">Available Hosts</h2>
            </div>
            <button onClick={() => { setStep('REQUEST'); setAcceptedHost(null); setHosts([]); }} className="glass-surface min-h-[44px] rounded-[18px] px-4 py-2.5 text-sm font-semibold text-cyan-300">Cancel</button>
          </div>

          {/* Show accepted host at the top (first-responder like Uber) */}
          {acceptedHost && acceptanceCountdown > 0 && (
            <Card className="border-2 border-yellow-500/40 bg-yellow-900/20 shadow-[0_18px_40px_rgba(234,179,8,0.16)]">
              <div className="text-center mb-4">
                <p className="text-yellow-400 font-bold text-sm">✓ OFFER LOCKED - Confirm within {acceptanceCountdown}s</p>
                <p className="text-xs text-yellow-300 mt-1">First host to accept your request</p>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="premium-number font-black text-2xl text-white">${acceptedHost.price}/hr</p>
                  <p className="text-sm text-gray-400">Locked • ETA: {acceptedHost.estimatedArrival} mins • ⭐ 4.9</p>
                </div>
                <Button onClick={() => selectHost({ ...acceptedHost, hostId: acceptedHost.hostId })} className="w-full px-6 py-2 bg-yellow-600 hover:bg-yellow-700 sm:w-auto">Confirm Now</Button>
              </div>
            </Card>
          )}

          {hosts.length === 0 && !acceptedHost ? <div className="glass-surface skeleton-shimmer py-10 text-center text-gray-500">Broadcasting your request to nearby hosts...</div> : null}
          {hosts.length === 0 && acceptedHost && acceptanceCountdown <= 0 ? <div className="glass-surface skeleton-shimmer py-10 text-center text-gray-500">Offer expired. Broadcasting your request to nearby hosts...</div> : null}

          {/* Show all hosts, but accepted one should already be selected if user confirmed */}
          {hosts
            .filter(h => !acceptedHost || h.hostId !== acceptedHost.hostId) // Don't duplicate accepted host
            .slice(0, 10)
            .map(h => (
              <Card key={h.id} className="flex flex-col gap-4 opacity-90 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-gradient-to-br from-blue-500/30 to-emerald-400/20 text-sm font-black text-white">{String(h.hostId || 'H').slice(-2)}</div>
                    <p className="premium-number font-black text-xl text-white">${h.price}/hr</p>
                    {(h.verified || hostVerificationMap[String(h.hostId || '').trim()]) && <VerifiedBadge />}
                  </div>
                  <p className="text-sm text-gray-400">{h.distance || '1.2'} km away • ETA: {h.estimatedArrival} mins • ⭐ 4.9</p>
                  {h.address && <p className="text-xs text-gray-500 mt-1">📍 {h.address} {h.landmark ? `(${h.landmark})` : ''}</p>}
                </div>
                <Button onClick={() => selectHost(h)} className="w-full px-6 py-2 sm:w-auto" disabled={!!acceptedHost && acceptanceCountdown > 0}>Select</Button>
              </Card>
            ))}
        </div>
      )}

      {step === 'CONFIRM' && selectedHost && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Screen 3</p>
              <h2 className="text-2xl font-black text-white">Confirm Booking</h2>
            </div>
            <button onClick={() => setStep('MATCHING')} className="glass-surface min-h-[44px] rounded-[18px] px-4 py-2.5 text-sm font-semibold text-cyan-300">Back</button>
          </div>
          <Card className="overflow-hidden">
            <div className="mb-6 space-y-2">
              <div className="flex items-center justify-between"><span className="text-gray-400">Host ID</span><span className="text-white font-bold">{String(selectedHost.hostId || '----').slice(-4)}</span></div>
              {(selectedHost.verified || hostVerificationMap[String(selectedHost.hostId || '').trim()]) && (
                <div className="flex justify-end"><VerifiedBadge /></div>
              )}
              <div className="flex justify-between"><span className="text-gray-400">Distance</span><span className="text-white font-bold">{selectedHost.estimatedArrival} mins away</span></div>
              <div className="flex justify-between"><span className="text-gray-400">Rate</span><span className="text-white font-bold">${selectedHost.price}/hr</span></div>
              {selectedHost.address && <div className="text-sm text-gray-400 mt-2 border-t border-gray-800 pt-2">📍 {selectedHost.address} {selectedHost.landmark ? `(${selectedHost.landmark})` : ''}</div>}
            </div>
            <Button onClick={confirmBooking} disabled={loading}>{loading ? 'Confirming...' : 'Confirm Booking'}</Button>
            {selectedHost.location && (
              <Button variant="outline" className="mt-3" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedHost.location.lat},${selectedHost.location.lng}`, '_blank')}>🗺️ Navigate to Host</Button>
            )}
          </Card>
        </div>
      )}

      {step === 'CHARGING' && canRenderActiveBooking && activeBooking && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Screen 4</p>
              <h2 className="text-2xl font-black text-white">Live Session</h2>
            </div>
            {canOpenChat && (
              <button
                onClick={() => setChatOpen(true)}
                className="relative min-h-[44px] rounded-[14px] border border-gray-700 px-3.5 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-gray-900"
              >
                Chat
                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* ===== WAITING FOR HOST TO SCAN PIN ===== */}
          {activeBooking.status === 'CONFIRMED' && (
            <Card className="tesla-panel text-center py-8">
              <div className="tesla-status mx-auto mb-4">
                <span className="status-dot" />
                Host pairing in progress
              </div>
              <p className="text-gray-300 mb-2 text-sm">Show this PIN to your host to start charging</p>
              <div className="my-6 pin-display inline-block w-full">
                <p className="text-xs text-cyan-300 uppercase tracking-widest mb-2">Start PIN</p>
                <p className="pin-text">
                  {activeBooking.startPin || '----'}
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-2">Host enters this code and charging starts instantly.</p>
              <div className="flex gap-2 mt-4">
                {selectedHost?.location && (
                  <Button variant="outline" className="flex-1 py-2 text-xs" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedHost.location.lat},${selectedHost.location.lng}`, '_blank')}>🗺️ Navigate to Host</Button>
                )}
              </div>
            </Card>
          )}

          {/* ===== CHARGING IN PROGRESS ===== */}
          {activeBooking.status === 'STARTED' && (
            <Card className="tesla-panel text-center py-8">
              {!hostOnline && (
                <div className="mb-4 rounded-lg border border-amber-700 bg-amber-900/30 px-3 py-2 text-left text-sm text-amber-300">
                  Host appears offline. You can use Emergency Stop to prevent the session from being stuck.
                </div>
              )}
              <p className="text-xs text-green-300 uppercase tracking-widest mb-3">Charging Started</p>
              <div className="battery-wrap">
                <div className="battery" style={{ '--battery-level': `${Math.min(95, 18 + Math.floor(elapsedSeconds / 15))}%` }}>
                  <div className="battery-fill" />
                  <div className="battery-glow" />
                </div>
              </div>
              <div className="my-4">
                <p className="text-5xl font-mono text-white mb-2">{formatTime(elapsedSeconds)}</p>
                <p className="premium-number text-3xl text-cyan-300 font-black">${runningCost}</p>
                <p className="text-xs text-gray-500 mt-1">Running cost @ ${activeBooking.price}/hr</p>
              </div>
              <div className="my-6 pin-display inline-block w-full">
                <p className="text-xs text-orange-300 uppercase tracking-widest mb-2">Stop PIN</p>
                <p className="pin-text">
                  {activeBooking.stopPin || '----'}
                </p>
              </div>
              <p className="text-xs text-gray-400">Show this PIN to your host when done charging.</p>

              {/* ── Charging mode toggle ── */}
              <div className="mt-5">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Charging Mode</p>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                  {[{ id: 'eco', label: '🌿 Eco', hint: '−20%' }, { id: 'normal', label: '⚡ Normal', hint: '×1' }, { id: 'boost', label: '🚀 Boost', hint: '+20%' }].map(({ id, label, hint }) => {
                    const active = (activeBooking.chargingMode || 'normal') === id;
                    return (
                      <button
                        key={id}
                        onClick={() => changeMode(id)}
                        disabled={loading}
                        className={`min-h-[46px] flex-1 rounded-[14px] border-2 py-2.5 text-sm font-semibold transition-all ${active ? 'border-cyan-500 bg-cyan-900/40 text-cyan-300' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
                      >
                        {label}<br /><span className="text-xs opacity-70">{hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Emergency stop ── */}
              <button
                onClick={emergencyStop}
                disabled={loading}
                className="mt-5 min-h-[48px] w-full rounded-[14px] border-2 border-red-700 bg-red-900/60 py-3 text-sm font-semibold text-red-400 transition-all hover:bg-red-800/60 disabled:opacity-50"
              >
                ⛔ Emergency Stop (no PIN)
              </button>
            </Card>
          )}
        </div>
      )}

      {chatOpen && canOpenChat && canRenderActiveBooking && (
        <ChatScreen
          booking={activeBooking}
          myUserId={user}
          onClose={() => setChatOpen(false)}
        />
      )}

      {step === 'PAYMENT' && canRenderActiveBooking && activeBooking && (
        <div className="space-y-4 text-center">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Payment checkpoint</p>
            <h2 className="text-2xl font-black text-white">Settle Payment</h2>
          </div>
          <PaymentScreen
            booking={activeBooking}
            myUserId={user}
            confirmPayment={confirmPayment}
            loading={loading}
          />
        </div>
      )}

      {step === 'RATING' && canRenderActiveBooking && activeBooking && (
        <RatingScreen
          booking={activeBooking}
          myUserId={user}
          role="user"
          onDone={() => {
            setActiveBooking(null, 'user');
            setActiveRequest(null);
            setStep('REQUEST');
            syncStateFromBackend();
          }}
        />
      )}
    </div>
  );
}