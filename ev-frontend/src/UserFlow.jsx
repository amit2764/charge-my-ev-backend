import { useState, useEffect } from 'react';
import api from './api';
import { socket } from './socket';
import { useStore } from './store';
import { Button, Card, Input } from './components';
import './FlowVisuals.css';

const FLOW_STEPS = ['Request', 'PIN', 'Charging', 'Payment', 'Done'];

function readDismissedPaymentBookings() {
  try {
    const raw = localStorage.getItem('dismissedPaymentBookings');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDismissedPaymentBookings(ids) {
  try {
    localStorage.setItem('dismissedPaymentBookings', JSON.stringify(ids));
  } catch {
    // Ignore storage write failures so UI does not crash in restricted browsers.
  }
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

function deriveUserStep(booking) {
  if (!booking) return 'REQUEST';
  const status = booking.status;
  if (status === 'BOOKED' || status === 'CONFIRMED' || status === 'STARTED') return 'CHARGING';
  if (status === 'COMPLETED') {
    return booking.paymentStatus === 'CONFIRMED' ? 'RATING' : 'PAYMENT';
  }
  return 'REQUEST';
}

export default function UserFlow() {
  const { user, userProfile, activeRequest, setActiveRequest, activeBooking, setActiveBooking } = useStore();
  const [step, setStep] = useState('REQUEST'); // REQUEST, MATCHING, CONFIRM, CHARGING, PAYMENT, RATING
  const [hosts, setHosts] = useState([]);
  const [selectedHost, setSelectedHost] = useState(null);
  const [acceptedHost, setAcceptedHost] = useState(null); // { hostId, expiresInSeconds, price, estimatedArrival }
  const [acceptanceCountdown, setAcceptanceCountdown] = useState(0);
  
  // Live Charging Timer State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dismissedPaymentBookings, setDismissedPaymentBookings] = useState(readDismissedPaymentBookings);
  const flowIndex = getFlowIndex(step, activeBooking);

  const markPaymentBookingDismissed = (bookingId) => {
    if (!bookingId) return;
    setDismissedPaymentBookings(prev => {
      if (prev.includes(bookingId)) return prev;
      const next = [...prev, bookingId];
      writeDismissedPaymentBookings(next);
      return next;
    });
  };

  const clearDismissedPaymentBooking = (bookingId) => {
    if (!bookingId) return;
    setDismissedPaymentBookings(prev => {
      if (!prev.includes(bookingId)) return prev;
      const next = prev.filter(id => id !== bookingId);
      writeDismissedPaymentBookings(next);
      return next;
    });
  };

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
    socket.connect();
    
    socket.on('response_update', (data) => {
      if (data.action === 'added' || data.action === 'modified') {
        setHosts(prev => {
          const exists = prev.find(h => h.id === data.response.id);
          return exists ? prev.map(h => h.id === data.response.id ? data.response : h) : [...prev, data.response];
        });
      }
    });

    // Listen to request_accepted event (first host accepted = Uber-style lock)
    socket.on('request_accepted', (data) => {
      setAcceptedHost({
        hostId: data.hostId,
        expiresInSeconds: 30,
        price: data.price,
        estimatedArrival: data.estimatedArrival
      });
      setAcceptanceCountdown(30);
    });

    // Host verified the start PIN → session started, get stopPin
    socket.on('session_started', ({ booking }) => {
      setActiveBooking(booking, 'user');
      setStep('CHARGING');
    });

    // Host verified the stop PIN → session completed
    socket.on('session_stopped', ({ booking, finalAmount }) => {
      setActiveBooking({
        ...booking,
        finalAmount,
        paymentStatus: booking.paymentStatus || 'PENDING',
        payment: booking.payment || { userConfirmed: false, hostConfirmed: false, status: 'PENDING' }
      }, 'user');
      setStep('PAYMENT');
    });

    socket.on('payment_update', ({ bookingId, paymentStatus, payment }) => {
      setActiveBooking(prev => {
        if (!prev || prev.id !== bookingId) return prev;
        return {
          ...prev,
          paymentStatus,
          payment
        };
      }, 'user');

      // Move to rating only after full payment confirmation is complete.
      if (paymentStatus === 'CONFIRMED') {
        clearDismissedPaymentBooking(bookingId);
        setStep('RATING');
      }
    });

    socket.on('mode_changed', ({ bookingId, mode }) => {
      setActiveBooking(prev => {
        if (!prev || prev.id !== bookingId) return prev;
        return { ...prev, chargingMode: mode };
      }, 'user');
    });

    return () => {
      socket.off('response_update');
      socket.off('request_accepted');
      socket.off('session_started');
      socket.off('session_stopped');
      socket.off('payment_update');
      socket.off('mode_changed');
      socket.disconnect();
    };
  }, [setActiveBooking]);

  useEffect(() => {
    const recover = async () => {
      if (!user) return;

      if (activeBooking?.userId === user) {
        setStep(deriveUserStep(activeBooking));
        return;
      }

      try {
        const res = await api.get(`/api/bookings/active?userId=${encodeURIComponent(user)}&role=user`);
        const booking = res.data?.booking;
        const status = String(booking?.status || '').toUpperCase();
        const paymentStatus = String(booking?.paymentStatus || 'PENDING').toUpperCase();

        if (
          booking &&
          status === 'COMPLETED' &&
          paymentStatus !== 'CONFIRMED' &&
          dismissedPaymentBookings.includes(booking.id)
        ) {
          setActiveBooking(null, 'user');
          setStep('REQUEST');
          return;
        }

        if (booking) {
          setActiveBooking(booking, 'user');
          setStep(deriveUserStep(booking));
        }
      } catch {
        // Keep current screen as fallback.
      }
    };

    recover();
  }, [user, activeBooking, setActiveBooking, dismissedPaymentBookings]);

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

        setActiveBooking(prev => {
          if (!prev || prev.id !== activeBooking.id) return prev;
          return {
            ...prev,
            paymentStatus,
            payment: payment || prev.payment
          };
        }, 'user');

        if (paymentStatus === 'CONFIRMED') {
          setStep('RATING');
        }
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
  }, [step, activeBooking?.id, activeBooking?.paymentStatus, setActiveBooking]);

  const handleSearchHosts = () => {
    setLoading(true); setError('');
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

  const createRequest = async (location) => {
    try {
      const res = await api.post('/api/request', { userId: user, location, vehicleType: userProfile?.vehicleType || 'electric' });
      setActiveRequest(res.data.request);
      socket.emit('subscribe', { userId: user, requestId: res.data.request.id });
      setStep('MATCHING');
    } catch (err) { 
      setError('Failed to create request: ' + (err.response?.data?.error || err.message)); 
    } finally {
      setLoading(false);
    }
  };

  const selectHost = (host) => {
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
      setStep('CHARGING');
    } catch (err) { 
      setError('Booking failed: ' + (err.response?.data?.error || err.message)); 
    } finally { setLoading(false); }
  };

  const payCash = async () => {
    if (!activeBooking?.id) {
      setError('No active booking found for payment.');
      setStep('REQUEST');
      return;
    }

    setLoading(true); setError('');
    try {
      const res = await api.post('/api/payment/confirm', { bookingId: activeBooking.id, confirmerId: user, role: 'user', confirmed: true });
      if (res.data?.booking) {
        setActiveBooking(res.data.booking, 'user');
      } else {
        // Keep UI responsive even if backend returns a partial object.
        setActiveBooking(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            paymentStatus: 'PENDING',
            payment: {
              ...(prev.payment || {}),
              status: prev.payment?.status || 'PENDING',
              userConfirmed: true
            }
          };
        }, 'user');
      }

      // For cash flow, host also confirms receipt. Stay on payment screen until CONFIRMED.
      const status = res.data?.booking?.paymentStatus || res.data?.payment?.status;
      if (status === 'CONFIRMED') {
        setStep('RATING');
      }
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
        setActiveBooking({ ...res.data.booking, finalAmount: res.data.finalAmount }, 'user');
      }
      setStep('PAYMENT');
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
      setActiveBooking(prev => prev ? { ...prev, chargingMode: mode } : prev, 'user');
    } catch (err) {
      setError('Mode change failed: ' + (err.response?.data?.error || err.message));
    } finally { setLoading(false); }
  };

  const submitRating = async () => {
    if (!activeBooking?.id || !activeBooking?.hostId) {
      setError('No completed booking found to rate.');
      setStep('REQUEST');
      return;
    }

    setLoading(true); setError('');
    try {
      await api.post('/api/rating', { bookingId: activeBooking.id, userId: user, hostId: activeBooking.hostId, rating, review });
      setActiveBooking(null); setActiveRequest(null); setHosts([]); setElapsedSeconds(0); setStep('REQUEST');
    } catch (err) { 
      setError('Failed to submit rating: ' + (err.response?.data?.error || err.message)); 
    } finally { setLoading(false); }
  };

  const dismissPaymentWait = () => {
    markPaymentBookingDismissed(activeBooking?.id);
    setActiveBooking(null, 'user');
    setActiveRequest(null);
    setHosts([]);
    setElapsedSeconds(0);
    setStep('REQUEST');
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
  const displayFinalAmount = toFiniteNumber(activeBooking?.finalAmount, 0).toFixed(2);
  const displayDurationMinutes = toFiniteNumber(activeBooking?.durationMinutes, 0).toFixed(1);

  return (
    <div className="p-4 pb-28 flow-shell">
      {error && <div className="p-3 mb-4 text-sm text-red-400 bg-red-900/50 border border-red-800 rounded-lg animate-pulse">{error}</div>}

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
          <h2 className="text-2xl font-bold text-white">Request Charge</h2>
          <Card>
            <Input label="Vehicle Type" value={userProfile?.vehicleType || 'Electric Sedan'} disabled />
            <Button onClick={handleSearchHosts} disabled={loading}>{loading ? 'Locating & Searching...' : '📍 Auto-Locate & Search'}</Button>
          </Card>
        </div>
      )}

      {step === 'MATCHING' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Available Hosts</h2>
            <button onClick={() => { setStep('REQUEST'); setAcceptedHost(null); setHosts([]); }} className="text-cyan-400 text-sm">Cancel</button>
          </div>

          {/* Show accepted host at the top (first-responder like Uber) */}
          {acceptedHost && acceptanceCountdown > 0 && (
            <Card className="border-2 border-yellow-500 bg-yellow-900/20">
              <div className="text-center mb-4">
                <p className="text-yellow-400 font-bold text-sm">✓ OFFER LOCKED - Confirm within {acceptanceCountdown}s</p>
                <p className="text-xs text-yellow-300 mt-1">First host to accept your request</p>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-lg text-white">${acceptedHost.price}/hr</p>
                  <p className="text-sm text-gray-400">Locked • ETA: {acceptedHost.estimatedArrival} mins • ⭐ 4.9</p>
                </div>
                <Button onClick={() => selectHost({ ...acceptedHost, hostId: acceptedHost.hostId })} className="w-auto px-6 py-2 bg-yellow-600 hover:bg-yellow-700">Confirm Now</Button>
              </div>
            </Card>
          )}

          {hosts.length === 0 && !acceptedHost ? <p className="text-gray-500 text-center py-10 animate-pulse">Broadcasting your request to nearby hosts...</p> : null}
          {hosts.length === 0 && acceptedHost && acceptanceCountdown <= 0 ? <p className="text-gray-500 text-center py-10 animate-pulse">Offer expired. Broadcasting your request to nearby hosts...</p> : null}

          {/* Show all hosts, but accepted one should already be selected if user confirmed */}
          {hosts
            .filter(h => !acceptedHost || h.hostId !== acceptedHost.hostId) // Don't duplicate accepted host
            .slice(0, 10)
            .map(h => (
              <Card key={h.id} className="flex justify-between items-center opacity-75">
                <div>
                  <p className="font-bold text-lg text-white">${h.price}/hr</p>
                  <p className="text-sm text-gray-400">{h.distance || '1.2'} km away • ETA: {h.estimatedArrival} mins • ⭐ 4.9</p>
                  {h.address && <p className="text-xs text-gray-500 mt-1">📍 {h.address} {h.landmark ? `(${h.landmark})` : ''}</p>}
                </div>
                <Button onClick={() => selectHost(h)} className="w-auto px-6 py-2" disabled={!!acceptedHost && acceptanceCountdown > 0}>Select</Button>
              </Card>
            ))}
        </div>
      )}

      {step === 'CONFIRM' && selectedHost && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-white">Confirm Booking</h2>
            <button onClick={() => setStep('MATCHING')} className="text-cyan-400 text-sm">Back</button>
          </div>
          <Card>
            <div className="mb-6 space-y-2">
              <div className="flex justify-between"><span className="text-gray-400">Host ID</span><span className="text-white font-bold">{String(selectedHost.hostId || '----').slice(-4)}</span></div>
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

      {step === 'CHARGING' && activeBooking && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Live Session</h2>

          {/* ===== WAITING FOR HOST TO SCAN PIN ===== */}
          {(activeBooking.status === 'CONFIRMED' || activeBooking.status === 'BOOKED') && (
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
              <p className="text-xs text-green-300 uppercase tracking-widest mb-3">Charging Started</p>
              <div className="battery-wrap">
                <div className="battery" style={{ '--battery-level': `${Math.min(95, 18 + Math.floor(elapsedSeconds / 15))}%` }}>
                  <div className="battery-fill" />
                  <div className="battery-glow" />
                </div>
              </div>
              <div className="my-4">
                <p className="text-5xl font-mono text-white mb-2">{formatTime(elapsedSeconds)}</p>
                <p className="text-2xl text-cyan-400 font-bold">${runningCost}</p>
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
                <div className="flex gap-2 justify-center">
                  {[{ id: 'eco', label: '🌿 Eco', hint: '−20%' }, { id: 'normal', label: '⚡ Normal', hint: '×1' }, { id: 'boost', label: '🚀 Boost', hint: '+20%' }].map(({ id, label, hint }) => {
                    const active = (activeBooking.chargingMode || 'normal') === id;
                    return (
                      <button
                        key={id}
                        onClick={() => changeMode(id)}
                        disabled={loading}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${active ? 'border-cyan-500 bg-cyan-900/40 text-cyan-300' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
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
                className="mt-5 w-full py-3 rounded-lg bg-red-900/60 border-2 border-red-700 text-red-400 font-semibold text-sm hover:bg-red-800/60 transition-all disabled:opacity-50"
              >
                ⛔ Emergency Stop (no PIN)
              </button>
            </Card>
          )}
        </div>
      )}

      {step === 'PAYMENT' && activeBooking && (
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-bold text-white">Settle Payment</h2>
          <Card className="tesla-panel">
            <p className="text-5xl font-black text-white my-6">${displayFinalAmount}</p>
            <p className="text-gray-400 mb-6">Duration: {displayDurationMinutes} mins</p>

            <div className="payment-checklist mb-5">
              <div className="payment-row">
                <span className="text-sm text-gray-200">You confirmed payment</span>
                <span className={`state ${activeBooking.payment?.userConfirmed ? 'done' : 'pending'}`}>
                  {activeBooking.payment?.userConfirmed ? 'Done' : 'Pending'}
                </span>
              </div>
              <div className="payment-row">
                <span className="text-sm text-gray-200">Host confirmed receipt</span>
                <span className={`state ${activeBooking.payment?.hostConfirmed ? 'done' : 'pending'}`}>
                  {activeBooking.payment?.hostConfirmed ? 'Done' : 'Pending'}
                </span>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Status: <span className="font-bold text-cyan-300">{activeBooking.paymentStatus || 'PENDING'}</span>.
              {activeBooking.paymentStatus !== 'CONFIRMED' ? ' You will auto-advance once host confirms.' : ' Payment complete.'}
            </p>
            <Button onClick={payCash} disabled={loading || activeBooking.payment?.userConfirmed || activeBooking.paymentStatus === 'CONFIRMED'}>
              {loading ? 'Processing...' : (activeBooking.payment?.userConfirmed ? 'Cash Marked Paid' : 'I Paid Cash')}
            </Button>
            {activeBooking.payment?.userConfirmed && activeBooking.paymentStatus !== 'CONFIRMED' && (
              <Button variant="outline" className="mt-3" onClick={dismissPaymentWait}>
                Exit For Now
              </Button>
            )}
            <Button variant="outline" className="mt-3" disabled>Pay Online (Soon)</Button>
          </Card>
        </div>
      )}

      {step === 'RATING' && activeBooking && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white text-center">Rate Your Host</h2>
          <Card>
            <div className="flex justify-center gap-2 mb-6">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setRating(star)} className={`text-4xl ${rating >= star ? 'text-yellow-400' : 'text-gray-700'}`}>
                  ★
                </button>
              ))}
            </div>
            <Input placeholder="Leave a review (optional)..." value={review} onChange={e => setReview(e.target.value)} />
            <Button onClick={submitRating} disabled={loading}>{loading ? 'Submitting...' : 'Submit Feedback'}</Button>
          </Card>
        </div>
      )}
    </div>
  );
}