import { useState, useEffect } from 'react';
import api from './api';
import { socket } from './socket';
import { useStore } from './store';
import { Button, Card, Input } from './components';

export default function UserFlow() {
  const { user, userProfile, activeRequest, setActiveRequest, activeBooking, setActiveBooking } = useStore();
  const [step, setStep] = useState('REQUEST'); // REQUEST, MATCHING, CONFIRM, CHARGING, PAYMENT, RATING
  const [hosts, setHosts] = useState([]);
  const [selectedHost, setSelectedHost] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [acceptedHost, setAcceptedHost] = useState(null); // { hostId, expiresInSeconds, price, estimatedArrival }
  const [acceptanceCountdown, setAcceptanceCountdown] = useState(0);
  
  // Live Charging Timer State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      setActiveBooking(booking);
      setStep('CHARGING');
    });

    // Host verified the stop PIN → session completed
    socket.on('session_stopped', ({ booking, finalAmount }) => {
      setActiveBooking({ ...booking, finalAmount });
      setStep('PAYMENT');
    });

    return () => {
      socket.off('response_update');
      socket.off('request_accepted');
      socket.off('session_started');
      socket.off('session_stopped');
      socket.disconnect();
    };
  }, []);

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
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/book', { userId: user, hostId: selectedHost.hostId, chargerId: 'charger_auto', price: selectedHost.price, requestId: activeRequest.id });
      setActiveBooking(res.data.booking);
      setStep('CHARGING');
    } catch (err) { 
      setError('Booking failed: ' + (err.response?.data?.error || err.message)); 
    } finally { setLoading(false); }
  };

  const startCharging = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/start', { bookingId: activeBooking.id, otp: otpInput });
      setActiveBooking(res.data.booking);
      setOtpInput('');
    } catch (err) { 
      setError(err.response?.data?.error || 'Invalid Start OTP. Please check the code.'); 
    } finally { setLoading(false); }
  };

  const stopCharging = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/stop', { bookingId: activeBooking.id, otp: otpInput });
      setActiveBooking({ ...res.data.booking, finalAmount: res.data.finalAmount });
      setStep('PAYMENT');
    } catch (err) { 
      setError(err.response?.data?.error || 'Invalid Stop OTP. Please check the code.'); 
    } finally { setLoading(false); }
  };

  const payCash = async () => {
    setLoading(true); setError('');
    try {
      await api.post('/api/payment/confirm', { bookingId: activeBooking.id, confirmerId: user, role: 'user', confirmed: true });
      setStep('RATING');
    } catch (err) { 
      setError('Payment failed: ' + (err.response?.data?.error || err.message)); 
    } finally { setLoading(false); }
  };

  const submitRating = async () => {
    setLoading(true); setError('');
    try {
      await api.post('/api/rating', { bookingId: activeBooking.id, userId: user, hostId: activeBooking.hostId, rating, review });
      setActiveBooking(null); setActiveRequest(null); setHosts([]); setElapsedSeconds(0); setStep('REQUEST');
    } catch (err) { 
      setError('Failed to submit rating: ' + (err.response?.data?.error || err.message)); 
    } finally { setLoading(false); }
  };

  // Formatting helpers
  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600).toString().padStart(2, '0');
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };
  const runningCost = activeBooking?.price ? ((elapsedSeconds / 3600) * activeBooking.price).toFixed(2) : '0.00';

  return (
    <div className="p-4 pb-28">
      {error && <div className="p-3 mb-4 text-sm text-red-400 bg-red-900/50 border border-red-800 rounded-lg animate-pulse">{error}</div>}

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
              <div className="flex justify-between"><span className="text-gray-400">Host ID</span><span className="text-white font-bold">{selectedHost.hostId.slice(-4)}</span></div>
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
            <Card className="text-center py-8">
              <p className="text-gray-400 mb-2 text-sm">Show this PIN to your host to start charging</p>
              <div className="my-6 p-6 bg-gray-900 rounded-2xl border-2 border-cyan-500 inline-block w-full">
                <p className="text-xs text-cyan-400 uppercase tracking-widest mb-2">Start PIN</p>
                <p className="text-7xl font-black tracking-[0.3em] text-white font-mono">
                  {activeBooking.startPin || '----'}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-2">⚡ Host will type this code to begin the session</p>
              <div className="flex gap-2 mt-4">
                {selectedHost?.location && (
                  <Button variant="outline" className="flex-1 py-2 text-xs" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedHost.location.lat},${selectedHost.location.lng}`, '_blank')}>🗺️ Navigate to Host</Button>
                )}
              </div>
            </Card>
          )}

          {/* ===== CHARGING IN PROGRESS ===== */}
          {activeBooking.status === 'STARTED' && (
            <Card className="text-center py-8">
              <p className="text-xs text-green-400 uppercase tracking-widest mb-4">⚡ Charging In Progress</p>
              <div className="my-4">
                <p className="text-5xl font-mono text-white mb-2">{formatTime(elapsedSeconds)}</p>
                <p className="text-2xl text-cyan-400 font-bold">${runningCost}</p>
                <p className="text-xs text-gray-500 mt-1">Running cost @ ${activeBooking.price}/hr</p>
              </div>
              <div className="my-6 p-6 bg-gray-900 rounded-2xl border-2 border-orange-500 inline-block w-full">
                <p className="text-xs text-orange-400 uppercase tracking-widest mb-2">Stop PIN</p>
                <p className="text-7xl font-black tracking-[0.3em] text-white font-mono">
                  {activeBooking.stopPin || '----'}
                </p>
              </div>
              <p className="text-xs text-gray-500">Show this PIN to your host when done charging</p>
            </Card>
          )}
        </div>
      )}

      {step === 'PAYMENT' && activeBooking && (
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-bold text-white">Session Complete</h2>
          <Card>
            <p className="text-5xl font-black text-white my-6">${activeBooking.finalAmount}</p>
            <p className="text-gray-400 mb-6">Duration: {activeBooking.durationMinutes?.toFixed(1)} mins</p>
            <Button onClick={payCash} disabled={loading}>{loading ? 'Processing...' : 'I Paid Cash'}</Button>
            <Button variant="outline" className="mt-3">Pay Online (Soon)</Button>
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