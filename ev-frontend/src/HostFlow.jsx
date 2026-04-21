import { useState, useEffect, useCallback } from 'react';
import api from './api';
import { socket } from './socket';
import { useStore } from './store';
import { Button, Card, Input } from './components';
import PaymentScreen from './PaymentScreen';
import HostOnboarding from './HostOnboarding';
import { db } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { resolveBookingState } from './resolveBookingState';
import { useHostBoot, fetchActiveBookingForHost } from './useHostBoot';
import MyChargersScreen from './screens/host/MyChargersScreen';
import useChat from './hooks/useChat';
import ChatScreen from './screens/ChatScreen';
import RatingScreen from './screens/RatingScreen';
import './FlowVisuals.css';

const HOST_FLOW_STEPS = ['Online', 'PIN', 'Charging', 'Payment', 'Done'];

function toFiniteNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getHostFlowIndex(activeBooking, isHostAvailable) {
  if (!isHostAvailable && !activeBooking) return 0;
  if (!activeBooking) return 0;
  if (activeBooking.status === 'BOOKED' || activeBooking.status === 'CONFIRMED') return 1;
  if (activeBooking.status === 'STARTED') return 2;
  if (activeBooking.status === 'COMPLETED' && activeBooking.paymentStatus !== 'CONFIRMED') return 3;
  if (activeBooking.status === 'COMPLETED' && activeBooking.paymentStatus === 'CONFIRMED') return 4;
  return 0;
}

function canRenderHostBooking(booking, userId, bookingRole) {
  if (!booking) return false;
  if (bookingRole && bookingRole !== 'host') return false;
  if (booking.hostId && userId) return booking.hostId === userId;
  return true;
}

function isValidUserId(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && normalized !== 'null' && normalized !== 'undefined';
}

export default function HostFlow() {
  const { user, hostProfile, setHostProfile, isHostAvailable, setIsHostAvailable, activeBooking, activeBookingRole, setActiveBooking, setBookingStep } = useStore();
  const [requests, setRequests] = useState([]);
  const [price, setPrice] = useState('5.00');
  const [radiusKm, setRadiusKm] = useState('5');
  const [acceptedRequestId, setAcceptedRequestId] = useState(null); // Track which request we accepted
  const [acceptanceCountdown, setAcceptanceCountdown] = useState(0);
  
  // Live Session State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [otpInput, setOtpInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resolvedState, setResolvedState] = useState({ screen: 'HOME' });
  const [pendingBooking, setPendingBooking] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const hostFlowIndex = getHostFlowIndex(activeBooking, isHostAvailable);
  const hasValidUser = isValidUserId(user);

  const applyBookingResolution = useCallback((bookingDoc) => {
    const result = resolveBookingState(bookingDoc, user);
    setResolvedState(result);
    if (bookingDoc) {
      setBookingStep(String(bookingDoc.status || 'REQUEST').toUpperCase());
    } else {
      setBookingStep('REQUEST');
    }
    return result;
  }, [user, setBookingStep]);

  const fetchPendingRequests = useCallback(async () => {
    if (!isHostAvailable || !hasValidUser || activeBooking) return;

    const params = new URLSearchParams({
      hostId: user,
      hostLat: String(hostProfile?.location?.lat || ''),
      hostLng: String(hostProfile?.location?.lng || ''),
      radiusKm: String(Number(radiusKm) || 5)
    });

    try {
      const res = await api.get(`/api/requests/pending?${params.toString()}`);
      if (res.data && res.data.requests) setRequests(res.data.requests);
    } catch {
      // Fallback to socket stream on next update.
    }
  }, [isHostAvailable, hasValidUser, activeBooking, user, hostProfile?.location?.lat, hostProfile?.location?.lng, radiusKm]);

  const hostBootReady = useHostBoot(user, {
    navigateTo: (_screen, resolved) => {
      setResolvedState(resolved || { screen: 'HOME' });
    },
    onBooking: (booking) => {
      if (booking?.hostId && booking.hostId !== user) return;
      setPendingBooking(booking || null);
      setActiveBooking(booking, 'host');
      applyBookingResolution(booking);
    }
  });

  useEffect(() => {
    if (!hasValidUser || activeBooking?.id) {
      setPendingBooking(null);
      return;
    }

    let cancelled = false;
    fetchActiveBookingForHost(user)
      .then((booking) => {
        if (cancelled) return;
        if (!booking) {
          setPendingBooking(null);
          return;
        }
        const resolved = resolveBookingState(booking, user);
        if (resolved.screen !== 'HOME') {
          setPendingBooking(booking);
        } else {
          setPendingBooking(null);
        }
      })
      .catch(() => {
        if (!cancelled) setPendingBooking(null);
      });

    return () => {
      cancelled = true;
    };
  }, [user, hasValidUser, activeBooking?.id]);

  const syncStateFromBackend = useCallback(async () => {
    if (!hasValidUser) return;

    try {
      const res = await api.get(`/api/bookings/active?userId=${encodeURIComponent(user)}&role=host`);
      const booking = res.data?.booking || null;

      if (!booking) {
        setPendingBooking(null);
        if (activeBooking?.hostId === user) {
          setActiveBooking(null, 'host');
        }
        applyBookingResolution(null);
        return;
      }

      if (booking.hostId && booking.hostId !== user) {
        setActiveBooking(null, 'host');
        applyBookingResolution(null);
        return;
      }

      const localBooking = useStore.getState().activeBooking;
      const changed = !localBooking ||
        localBooking.id !== booking.id ||
        localBooking.status !== booking.status ||
        localBooking.paymentStatus !== booking.paymentStatus ||
        localBooking.chargingMode !== booking.chargingMode;

      if (changed) {
        setActiveBooking(booking, 'host');
      }

      setPendingBooking(booking);
      applyBookingResolution(booking);
    } catch {
      // Keep current screen and retry automatically.
    }
  }, [user, hasValidUser, activeBooking?.hostId, setActiveBooking, applyBookingResolution]);

  useEffect(() => {
    if (hostProfile && price === '5.00') setPrice(hostProfile.pricePerHour);
  }, [hostProfile, price]);

  // Acceptance countdown timer - shows how long user has to confirm
  useEffect(() => {
    let interval;
    if (acceptedRequestId && acceptanceCountdown > 0) {
      interval = setInterval(() => {
        setAcceptanceCountdown(prev => {
          if (prev <= 1) {
            setAcceptedRequestId(null); // Offer expired, can accept more requests
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [acceptedRequestId, acceptanceCountdown]);

  // Live Timer Effect for Host
  useEffect(() => {
    let interval;
    if (activeBooking?.status === 'STARTED' && activeBooking?.startTime) {
      interval = setInterval(() => {
        const start = new Date(activeBooking.startTime).getTime();
        setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeBooking]);

  // Realtime host channel: receive new requests and booking confirmations.
  useEffect(() => {
    if (!hasValidUser) return undefined;

    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [hasValidUser]);

  useEffect(() => {
    if (!hasValidUser || !socket.connected || !isHostAvailable) return;

    socket.emit('subscribe', {
      hostId: user,
      hostLocation: hostProfile?.location || null,
      searchRadiusKm: Number(radiusKm) || 5
    });
  }, [user, hasValidUser, isHostAvailable, hostProfile?.location, radiusKm]);

  useEffect(() => {
    if (!hasValidUser) return undefined;

    const onSocketConnect = () => {
      if (isHostAvailable) {
        socket.emit('subscribe', {
          hostId: user,
          hostLocation: hostProfile?.location || null,
          searchRadiusKm: Number(radiusKm) || 5
        });
        fetchPendingRequests();
      }
      syncStateFromBackend();
    };

    const onNewRequest = ({ request }) => {
      if (!request || activeBooking) return;
      setRequests(prev => {
        const exists = prev.some(r => r.id === request.id);
        return exists ? prev : [...prev, request];
      });
    };

    const onBookingConfirmed = ({ booking }) => {
      if (!booking || booking.hostId !== user) return;
      setActiveBooking(booking, 'host');
      applyBookingResolution(booking);
      setRequests([]);
    };

    // When host verified start PIN → update booking status
    const onSessionStarted = ({ booking }) => {
      if (!booking || booking.hostId !== user) return;
      setActiveBooking(booking, 'host');
      applyBookingResolution(booking);
    };

    // When session ends
    const onSessionStopped = ({ booking, finalAmount }) => {
      if (!booking || booking.hostId !== user) return;
      const nextBooking = { ...booking, finalAmount };
      setActiveBooking(nextBooking, 'host');
      applyBookingResolution(nextBooking);
      setElapsedSeconds(0);
    };

    const onPaymentUpdate = ({ bookingId, paymentStatus, payment }) => {
      const currentBooking = useStore.getState().activeBooking;
      if (!currentBooking || currentBooking.id !== bookingId) return;
      const nextBooking = {
        ...currentBooking,
        paymentStatus,
        payment: payment || currentBooking.payment
      };
      setActiveBooking(nextBooking, 'host');
      applyBookingResolution(nextBooking);
    };

    const onModeChanged = ({ bookingId, mode }) => {
      const currentBooking = useStore.getState().activeBooking;
      if (!currentBooking || currentBooking.id !== bookingId) return;
      const nextBooking = { ...currentBooking, chargingMode: mode };
      setActiveBooking(nextBooking, 'host');
      applyBookingResolution(nextBooking);
    };

    socket.on('new_request', onNewRequest);
    socket.on('booking_confirmed', onBookingConfirmed);
    socket.on('session_started', onSessionStarted);
    socket.on('session_stopped', onSessionStopped);
    socket.on('payment_update', onPaymentUpdate);
    socket.on('mode_changed', onModeChanged);
    socket.on('connect', onSocketConnect);

    if (isHostAvailable) {
      socket.emit('subscribe', {
        hostId: user,
        hostLocation: hostProfile?.location || null,
        searchRadiusKm: Number(radiusKm) || 5
      });
      fetchPendingRequests();
    }

    if (!isHostAvailable) setRequests([]);

    return () => {
      socket.off('new_request', onNewRequest);
      socket.off('booking_confirmed', onBookingConfirmed);
      socket.off('session_started', onSessionStarted);
      socket.off('session_stopped', onSessionStopped);
      socket.off('payment_update', onPaymentUpdate);
      socket.off('mode_changed', onModeChanged);
      socket.off('connect', onSocketConnect);
    };
  }, [isHostAvailable, activeBooking, user, hasValidUser, hostProfile, radiusKm, setActiveBooking, syncStateFromBackend, applyBookingResolution, fetchPendingRequests]);

  useEffect(() => {
    if (!hostBootReady) return;
    syncStateFromBackend();
  }, [hostBootReady, syncStateFromBackend]);

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
        if (booking.hostId && booking.hostId !== user) return;
        setActiveBooking(booking, 'host');
        applyBookingResolution(booking);
      },
      () => {
        // Firestore listener is best-effort; API sync remains fallback.
      }
    );

    return () => unsubscribe();
  }, [activeBooking?.id, user, setActiveBooking, applyBookingResolution]);

  // Fallback polling for payment status after session completion.
  useEffect(() => {
    if (!activeBooking?.id || activeBooking?.status !== 'COMPLETED' || activeBooking?.paymentStatus === 'CONFIRMED') {
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
        setActiveBooking(nextBooking, 'host');
        applyBookingResolution(nextBooking);
      } catch {
        // Keep retrying silently.
      }
    };

    pollPaymentStatus();
    const interval = setInterval(pollPaymentStatus, 4000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeBooking?.id, activeBooking?.status, activeBooking?.paymentStatus, setActiveBooking, applyBookingResolution]);

  const updateChargerLocation = () => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by this device/browser.');
      return;
    }

    setLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          ...(hostProfile || {}),
          location: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }
        };
        setHostProfile(next);
        setLoading(false);
      },
      () => {
        setError('Could not fetch charger location. Please enable GPS permissions.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const toggleAvailability = () => {
    if (!isHostAvailable && !hostProfile?.location) {
      setError('Set charger location first before going ONLINE.');
      return;
    }
    setError('');
    setIsHostAvailable(!isHostAvailable);
  };

  const acceptRequest = async (reqId) => {
    setLoading(true); setError('');
    try {
      await api.post('/api/respond', {
        requestId: reqId,
        hostId: user,
        status: 'ACCEPTED',
        price: parseFloat(price),
        estimatedArrival: 5,
        hostLocation: hostProfile?.location || null
      });
      // Success - lock this request until user confirms or 30s expires
      setAcceptedRequestId(reqId);
      setAcceptanceCountdown(30);
      // Remove this request from the list
      setRequests(prev => prev.filter(r => r.id !== reqId));
      await syncStateFromBackend();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      if (err.response?.status === 409) {
        // Another host got there first
        setError('⚡ Another host already accepted this request. Keep searching for more!');
        // Remove this request from the list
        setRequests(prev => prev.filter(r => r.id !== reqId));
      } else {
        setError('Failed to send offer: ' + errorMsg);
      }
    } finally { setLoading(false); }
  };

  const startSession = async () => {
    if (!activeBooking?.id) {
      setError('No active booking found to start.');
      return;
    }

    setLoading(true); setError('');
    try {
      const res = await api.post('/api/start', { bookingId: activeBooking.id, otp: otpInput });
      setActiveBooking(res.data.booking, 'host');
      applyBookingResolution(res.data.booking);
      setOtpInput('');
      await syncStateFromBackend();
    } catch (err) { 
      setError(err.response?.data?.error || 'Invalid Start OTP. Please check the code.'); 
    } finally { setLoading(false); }
  };

  const stopSession = async () => {
    if (!activeBooking?.id) {
      setError('No active booking found to stop.');
      return;
    }

    setLoading(true); setError('');
    try {
      const res = await api.post('/api/stop', { bookingId: activeBooking.id, otp: otpInput });
      const nextBooking = res.data?.booking
        ? { ...res.data.booking, finalAmount: res.data.finalAmount }
        : { ...activeBooking, finalAmount: res.data.finalAmount };
      setActiveBooking(nextBooking, 'host');
      applyBookingResolution(nextBooking);
      setElapsedSeconds(0);
      await syncStateFromBackend();
    } catch (err) { 
      setError(err.response?.data?.error || 'Invalid Stop OTP. Please check the code.'); 
    } finally { setLoading(false); }
  };

  const confirmPayment = async (bookingId, role) => {
    if (!bookingId) {
      setError('No completed booking found for payment confirmation.');
      return;
    }

    setLoading(true); setError('');
    try {
      const res = await api.post(`/api/bookings/${bookingId}/payment-confirm`, { role });
      if (res.data?.booking) {
        setActiveBooking(res.data.booking, 'host');
        applyBookingResolution(res.data.booking);
      }
      await syncStateFromBackend();
    } catch (err) {
      setError('Payment confirmation failed: ' + (err.response?.data?.error || err.message));
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
  const currentEarnings = bookingPrice > 0 ? ((elapsedSeconds / 3600) * bookingPrice).toFixed(2) : '0.00';
  const displayFinalAmount = toFiniteNumber(activeBooking?.finalAmount, 0).toFixed(2);
  const displayDurationMinutes = toFiniteNumber(activeBooking?.durationMinutes, 0).toFixed(1);
  const { unreadCount } = useChat(activeBooking, user);
  const chatEnabledStatuses = new Set(['BOOKED', 'CONFIRMED', 'STARTED']);
  const canOpenChat = !!activeBooking?.id && chatEnabledStatuses.has(String(activeBooking?.status || '').toUpperCase());
  const dashboardRevenue = activeBooking?.finalAmount || 0;

  if (activeBooking && canRenderHostBooking(activeBooking, user, activeBookingRole)) {
    return (
      <div className="flow-shell space-y-4 p-4 pb-6 sm:p-5">
        <div className="flow-rail">
          {HOST_FLOW_STEPS.map((label, index) => (
            <div
              key={label}
              className={`flow-pill ${index < hostFlowIndex ? 'done' : ''} ${index === hostFlowIndex ? 'active' : ''}`}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Screen 4</p>
            <h2 className="text-2xl font-black text-white">Active Charging Session</h2>
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
        {error && <div className="p-3 text-sm text-red-400 bg-red-900/50 border border-red-800 rounded-lg animate-pulse">{error}</div>}
        
        <Card className="tesla-panel text-center py-8">
          <p className="text-sm text-gray-400 mb-6">User: <span className="text-white font-bold">{activeBooking.userId?.slice(-6)}</span></p>
          
          {/* ===== CONFIRMED: waiting for user to arrive, host enters Start PIN ===== */}
          {resolvedState.screen === 'CHARGING_WAIT' && (
            <>
              <div className="tesla-status mx-auto mb-4">
                <span className="status-dot" />
                Waiting for start PIN
              </div>
              <p className="text-sm text-gray-300 mb-1">Ask the user to show their <span className="text-cyan-400 font-bold">Start PIN</span> on their phone.</p>
              <p className="text-xs text-gray-500 mb-5">Type the 4-digit code shown on their screen</p>
              <Input
                placeholder="Start PIN from user’s screen"
                value={otpInput}
                onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="text-center text-4xl tracking-[0.5em] font-mono mb-4"
                maxLength={4}
              />
              <Button onClick={startSession} disabled={loading || otpInput.length !== 4}>
                {loading ? 'Verifying...' : '⚡ Start Charge'}
              </Button>
            </>
          )}

          {/* ===== STARTED: charging running ===== */}
          {resolvedState.screen === 'CHARGING_RUN' && (
            <>
              <p className="text-xs text-green-300 uppercase tracking-widest mb-3">Charging In Progress</p>
              <div className="battery-wrap">
                <div className="battery" style={{ '--battery-level': `${Math.min(96, 20 + Math.floor(elapsedSeconds / 15))}%` }}>
                  <div className="battery-fill" />
                  <div className="battery-glow" />
                </div>
              </div>
              <div className="my-4">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Current Earnings</p>
                <p className="text-5xl text-green-400 font-black mb-2">${currentEarnings}</p>
                <p className="text-3xl font-mono text-white mb-4">{formatTime(elapsedSeconds)}</p>
              </div>
              <p className="text-sm text-gray-300 mb-1">Ask the user to show their <span className="text-orange-400 font-bold">Stop PIN</span> to end the session.</p>
              <p className="text-xs text-gray-500 mb-5">Type the 4-digit code shown on their screen</p>
              <Input
                placeholder="Stop PIN from user’s screen"
                value={otpInput}
                onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="text-center text-4xl tracking-[0.5em] font-mono mb-4"
                maxLength={4}
              />
              <Button variant="danger" onClick={stopSession} disabled={loading || otpInput.length !== 4}>
                {loading ? 'Stopping...' : '⏹ Stop Charge'}
              </Button>
            </>
          )}

          {/* ===== COMPLETED ===== */}
          {/* ===== RATING (post-payment) ===== */}
          {resolvedState.screen === 'RATING' && (
            <RatingScreen
              booking={activeBooking}
              myUserId={user}
              role="host"
              onDone={() => {
                setActiveBooking(null, 'host');
                setOtpInput('');
                syncStateFromBackend();
              }}
            />
          )}

          {/* ===== PAYMENT / SUPPORT / EXPIRED ===== */}
          {(
            resolvedState.screen === 'PAYMENT' ||
            resolvedState.screen === 'PAYMENT_EXPIRED' ||
            resolvedState.screen === 'SUPPORT' ||
            (activeBooking.status === 'COMPLETED' && resolvedState.screen !== 'RATING')
          ) && (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Total Earned</p>
              <p className="text-5xl text-green-400 font-black my-6">${displayFinalAmount}</p>
              <p className="text-gray-400 mb-6">{displayDurationMinutes} mins charging</p>
              <PaymentScreen
                booking={activeBooking}
                myUserId={user}
                confirmPayment={confirmPayment}
                loading={loading}
              />
              {activeBooking.paymentStatus === 'CONFIRMED' && (
                <Button onClick={() => { setActiveBooking(null); setOtpInput(''); }}>Return to Dashboard</Button>
              )}
            </>
          )}
        </Card>

        {chatOpen && canOpenChat && (
          <ChatScreen
            booking={activeBooking}
            myUserId={user}
            onClose={() => setChatOpen(false)}
          />
        )}
      </div>
    );
  }

  if (!hostProfile) return <HostOnboarding />;

  return (
    <div className="p-4 pb-6 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Host mode</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">Run your charger like a pro</h1>
          <p className="mt-1 text-sm text-slate-400">Premium dashboard for availability, incoming requests, analytics, and live session control.</p>
        </div>
        <div className="glass-surface hidden rounded-[20px] px-4 py-3 md:block">
          <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Mode</p>
          <p className="mt-1 text-sm font-semibold text-emerald-300">{isHostAvailable ? 'ONLINE' : 'OFFLINE'}</p>
        </div>
      </div>

      {error && <div className="glass-surface mb-4 rounded-[20px] border border-red-500/20 bg-red-900/20 p-3 text-sm text-red-300 animate-pulse">{error}</div>}

      {pendingBooking && (
        <Card className="mb-4 border border-amber-700 bg-amber-900/20">
          <p className="text-sm text-amber-300">You have an unresolved session.</p>
          <Button
            className="mt-3"
            onClick={() => {
              const r = resolveBookingState(pendingBooking, user);
              setResolvedState(r);
              setActiveBooking(pendingBooking, 'host');
              applyBookingResolution(pendingBooking);
            }}
          >
            Resume Session
          </Button>
        </Card>
      )}

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Screen 3</p>
            <h2 className="text-2xl font-black text-white">Host Dashboard</h2>
          </div>
          <button 
            onClick={toggleAvailability} 
            className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold tracking-[0.08em] transition-all ${isHostAvailable ? 'bg-gradient-to-r from-emerald-400 to-cyan-300 text-slate-950 shadow-[0_16px_34px_rgba(34,197,94,0.28)]' : 'glass-surface text-gray-400'}`}
          >
            {isHostAvailable ? 'ONLINE' : 'OFFLINE'}
          </button>
        </div>
        <p className="text-gray-400 text-sm">Set charger location once, then go online to receive nearby requests.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Earnings today</p>
            <p className="premium-number mt-2 text-3xl font-black text-emerald-300">₹{Number(dashboardRevenue || 0).toFixed(2)}</p>
          </Card>
          <Card>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Active requests</p>
            <p className="premium-number mt-2 text-3xl font-black text-white">{requests.length}</p>
          </Card>
          <Card>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Match radius</p>
            <p className="premium-number mt-2 text-3xl font-black text-cyan-300">{radiusKm}<span className="ml-1 text-lg text-slate-500">km</span></p>
          </Card>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          <Button variant="outline" className="py-2" onClick={updateChargerLocation} disabled={loading}>
            {loading ? 'Updating...' : '📍 Update Charger Location'}
          </Button>
          <Input
            label="Match Radius (km)"
            type="number"
            value={radiusKm}
            onChange={e => setRadiusKm(e.target.value)}
            className="mb-0"
          />
          <Input
            label="Charger GPS"
            value={hostProfile?.location ? `${hostProfile.location.lat.toFixed(4)}, ${hostProfile.location.lng.toFixed(4)}` : 'Not set'}
            disabled
            className="mb-0"
          />
        </div>
      </div>

      <h3 className="mb-3 font-bold text-white">Incoming Requests</h3>

      {/* Show accepted request status (waiting for user to confirm) */}
      {acceptedRequestId && acceptanceCountdown > 0 && (
        <Card className="mb-4 border-2 border-green-500/30 bg-green-900/20 shadow-[0_18px_40px_rgba(34,197,94,0.16)]">
          <div className="text-center mb-3">
            <p className="text-green-400 font-bold">✓ OFFER SENT - Waiting for user confirmation</p>
            <p className="text-2xl text-white font-bold mt-2">{acceptanceCountdown}s</p>
            <p className="text-xs text-green-300 mt-1">User has {acceptanceCountdown} seconds to confirm</p>
          </div>
          <p className="text-sm text-gray-400 text-center">You can accept other requests while waiting...</p>
        </Card>
      )}

      {!isHostAvailable ? (
        <Card className="text-center py-10 text-gray-500">You are currently offline.</Card>
      ) : requests.length === 0 ? (
        <Card className="skeleton-shimmer text-center py-10 text-gray-500 animate-pulse">Scanning for nearby drivers...</Card>
      ) : (
        requests.map(req => (
          <Card key={req.id} className="mb-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-bold capitalize text-white">{req.vehicleType} EV</p>
                <p className="text-sm text-gray-400">{req.distance} km away • ⭐ {req.rating}</p>
              </div>
              <span className="floating-chip"><span className="live-dot" /> Live request</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex-1 relative">
                <span className="absolute left-3.5 top-3.5 text-gray-400">$</span>
                <Input type="number" step="0.50" value={price} onChange={e => setPrice(e.target.value)} className="pl-8 mb-0" />
              </div>
              <Button 
                onClick={() => acceptRequest(req.id)} 
                disabled={loading} 
                className="w-full px-6 sm:w-auto"
              >
                {loading ? 'Sending...' : 'Offer Charge'}
              </Button>
            </div>
          </Card>
        ))
      )}

      <div className="mt-6">
        <MyChargersScreen hostId={user} />
      </div>
    </div>
  );
}