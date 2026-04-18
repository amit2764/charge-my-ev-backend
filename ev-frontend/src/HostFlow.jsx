import { useState, useEffect } from 'react';
import api from './api';
import { socket } from './socket';
import { useStore } from './store';
import { Button, Card, Input } from './components';
import HostOnboarding from './HostOnboarding';
import './FlowVisuals.css';

const HOST_FLOW_STEPS = ['Online', 'PIN', 'Charging', 'Payment', 'Done'];

function getHostFlowIndex(activeBooking, isHostAvailable) {
  if (!isHostAvailable && !activeBooking) return 0;
  if (!activeBooking) return 0;
  if (activeBooking.status === 'BOOKED' || activeBooking.status === 'CONFIRMED') return 1;
  if (activeBooking.status === 'STARTED') return 2;
  if (activeBooking.status === 'COMPLETED' && activeBooking.paymentStatus !== 'CONFIRMED') return 3;
  if (activeBooking.status === 'COMPLETED' && activeBooking.paymentStatus === 'CONFIRMED') return 4;
  return 0;
}

function canRenderHostBooking(booking, userId) {
  if (!booking) return false;
  if (booking.hostId && userId) return booking.hostId === userId;
  return true;
}

export default function HostFlow() {
  const { user, hostProfile, setHostProfile, isHostAvailable, setIsHostAvailable, activeBooking, setActiveBooking } = useStore();
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
  const hostFlowIndex = getHostFlowIndex(activeBooking, isHostAvailable);

  useEffect(() => {
    if (hostProfile && price === '5.00') setPrice(hostProfile.pricePerHour);
  }, [hostProfile]);

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
    socket.connect();

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
      setRequests([]);
    };

    // When host verified start PIN → update booking status
    const onSessionStarted = ({ booking }) => {
      if (!booking || booking.hostId !== user) return;
      setActiveBooking(booking, 'host');
    };

    // When session ends
    const onSessionStopped = ({ booking, finalAmount }) => {
      if (!booking || booking.hostId !== user) return;
      setActiveBooking({ ...booking, finalAmount }, 'host');
      setElapsedSeconds(0);
    };

    const onPaymentUpdate = ({ bookingId, paymentStatus, payment }) => {
      setActiveBooking(prev => {
        if (!prev || prev.id !== bookingId) return prev;
        return {
          ...prev,
          paymentStatus,
          payment
        };
      }, 'host');
    };

    socket.on('new_request', onNewRequest);
    socket.on('booking_confirmed', onBookingConfirmed);
    socket.on('session_started', onSessionStarted);
    socket.on('session_stopped', onSessionStopped);
    socket.on('payment_update', onPaymentUpdate);

    if (isHostAvailable) {
      socket.emit('subscribe', {
        hostId: user,
        hostLocation: hostProfile?.location || null,
        searchRadiusKm: Number(radiusKm) || 5
      });

      // Bootstrap pending requests once when going online.
      if (!activeBooking) {
        const params = new URLSearchParams({
          hostId: user,
          hostLat: String(hostProfile?.location?.lat || ''),
          hostLng: String(hostProfile?.location?.lng || ''),
          radiusKm: String(Number(radiusKm) || 5)
        });

        api.get(`/api/requests/pending?${params.toString()}`)
          .then(res => {
            if (res.data && res.data.requests) setRequests(res.data.requests);
          })
          .catch(() => {});
      }
    }

    if (!isHostAvailable) setRequests([]);

    return () => {
      socket.off('new_request', onNewRequest);
      socket.off('booking_confirmed', onBookingConfirmed);
      socket.off('session_started', onSessionStarted);
      socket.off('session_stopped', onSessionStopped);
      socket.off('payment_update', onPaymentUpdate);
      socket.disconnect();
    };
  }, [isHostAvailable, activeBooking, user, hostProfile, radiusKm, setActiveBooking]);

  useEffect(() => {
    const recover = async () => {
      if (!user) return;

      if (canRenderHostBooking(activeBooking, user)) {
        return;
      }

      try {
        const res = await api.get(`/api/bookings/active?userId=${encodeURIComponent(user)}&role=host`);
        const booking = res.data?.booking;
        if (booking) {
          setActiveBooking(booking, 'host');
        }
      } catch {
        // Keep current screen as fallback.
      }
    };

    recover();
  }, [user, activeBooking, setActiveBooking]);

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

        setActiveBooking(prev => {
          if (!prev || prev.id !== activeBooking.id) return prev;
          return {
            ...prev,
            paymentStatus,
            payment: payment || prev.payment
          };
        }, 'host');
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
  }, [activeBooking?.id, activeBooking?.status, activeBooking?.paymentStatus, setActiveBooking]);

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
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/start', { bookingId: activeBooking.id, otp: otpInput });
      setActiveBooking(res.data.booking, 'host');
      setOtpInput('');
    } catch (err) { 
      setError(err.response?.data?.error || 'Invalid Start OTP. Please check the code.'); 
    } finally { setLoading(false); }
  };

  const stopSession = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/stop', { bookingId: activeBooking.id, otp: otpInput });
      setActiveBooking({ ...activeBooking, status: 'COMPLETED', finalAmount: res.data.finalAmount }, 'host');
      setElapsedSeconds(0);
    } catch (err) { 
      setError(err.response?.data?.error || 'Invalid Stop OTP. Please check the code.'); 
    } finally { setLoading(false); }
  };

  const confirmCashReceived = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/payment/confirm', {
        bookingId: activeBooking.id,
        confirmerId: user,
        role: 'host',
        confirmed: true
      });
      if (res.data?.booking) {
        setActiveBooking(res.data.booking, 'host');
      }
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
  const currentEarnings = activeBooking?.price ? ((elapsedSeconds / 3600) * activeBooking.price).toFixed(2) : '0.00';

  if (!hostProfile) return <HostOnboarding />;

  if (activeBooking && canRenderHostBooking(activeBooking, user)) {
    return (
      <div className="p-4 pb-28 space-y-4 flow-shell">
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
        <h2 className="text-2xl font-bold text-white">Active Charging Session</h2>
        {error && <div className="p-3 text-sm text-red-400 bg-red-900/50 border border-red-800 rounded-lg animate-pulse">{error}</div>}
        
        <Card className="tesla-panel text-center py-8">
          <p className="text-sm text-gray-400 mb-6">User: <span className="text-white font-bold">{activeBooking.userId?.slice(-6)}</span></p>
          
          {/* ===== CONFIRMED: waiting for user to arrive, host enters Start PIN ===== */}
          {(activeBooking.status === 'BOOKED' || activeBooking.status === 'CONFIRMED') && (
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
          {activeBooking.status === 'STARTED' && (
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
          {activeBooking.status === 'COMPLETED' && (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Total Earned</p>
              <p className="text-5xl text-green-400 font-black my-6">${activeBooking.finalAmount}</p>
              <p className="text-gray-400 mb-6">{activeBooking.durationMinutes?.toFixed(1)} mins charging</p>
              <div className="payment-checklist mb-5">
                <div className="payment-row">
                  <span className="text-sm text-gray-200">User marked paid</span>
                  <span className={`state ${activeBooking.payment?.userConfirmed ? 'done' : 'pending'}`}>
                    {activeBooking.payment?.userConfirmed ? 'Done' : 'Pending'}
                  </span>
                </div>
                <div className="payment-row">
                  <span className="text-sm text-gray-200">Host marked received</span>
                  <span className={`state ${activeBooking.payment?.hostConfirmed ? 'done' : 'pending'}`}>
                    {activeBooking.payment?.hostConfirmed ? 'Done' : 'Pending'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-4">Payment status: <span className="font-bold text-cyan-300">{activeBooking.paymentStatus || 'PENDING'}</span></p>
              <Button onClick={confirmCashReceived} disabled={loading || activeBooking.paymentStatus === 'CONFIRMED'}>
                {activeBooking.paymentStatus === 'CONFIRMED' ? 'Cash Confirmed' : (loading ? 'Confirming...' : 'I Received Cash')}
              </Button>
              {activeBooking.paymentStatus === 'CONFIRMED' && (
                <Button onClick={() => { setActiveBooking(null); setOtpInput(''); }}>Return to Dashboard</Button>
              )}
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 pb-28">
      {error && <div className="p-3 mb-4 text-sm text-red-400 bg-red-900/50 border border-red-800 rounded-lg animate-pulse">{error}</div>}

      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-white">Host Dashboard</h2>
          <button 
            onClick={toggleAvailability} 
            className={`px-4 py-2 rounded-full font-bold text-sm transition-all ${isHostAvailable ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-gray-800 text-gray-400'}`}
          >
            {isHostAvailable ? 'ONLINE' : 'OFFLINE'}
          </button>
        </div>
        <p className="text-gray-400 text-sm">Set charger location once, then go online to receive nearby requests.</p>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
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

      <h3 className="font-bold text-white mb-3">Incoming Requests</h3>

      {/* Show accepted request status (waiting for user to confirm) */}
      {acceptedRequestId && acceptanceCountdown > 0 && (
        <Card className="mb-4 border-2 border-green-500 bg-green-900/20">
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
        <Card className="text-center py-10 text-gray-500 animate-pulse">Scanning for nearby drivers...</Card>
      ) : (
        requests.map(req => (
          <Card key={req.id} className="mb-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="font-bold capitalize text-white">{req.vehicleType} EV</p>
                <p className="text-sm text-gray-400">{req.distance} km away • ⭐ {req.rating}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3.5 top-3.5 text-gray-400">$</span>
                <Input type="number" step="0.50" value={price} onChange={e => setPrice(e.target.value)} className="pl-8 mb-0" />
              </div>
              <Button 
                onClick={() => acceptRequest(req.id)} 
                disabled={loading || (acceptedRequestId && acceptanceCountdown > 0)} 
                className="w-auto px-6"
              >
                {loading ? 'Sending...' : 'Offer Charge'}
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}