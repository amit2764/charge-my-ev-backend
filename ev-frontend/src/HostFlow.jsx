import { useState, useEffect } from 'react';
import api from './api';
import { socket } from './socket';
import { useStore } from './store';
import { Button, Card, Input } from './components';
import HostOnboarding from './HostOnboarding';

export default function HostFlow() {
  const { user, hostProfile, setHostProfile, isHostAvailable, setIsHostAvailable, activeBooking, setActiveBooking } = useStore();
  const [requests, setRequests] = useState([]);
  const [price, setPrice] = useState('5.00');
  const [radiusKm, setRadiusKm] = useState('5');
  
  // Live Session State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [otpInput, setOtpInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hostProfile && price === '5.00') setPrice(hostProfile.pricePerHour);
  }, [hostProfile]);

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
      setActiveBooking(booking);
      setRequests([]);
    };

    socket.on('new_request', onNewRequest);
    socket.on('booking_confirmed', onBookingConfirmed);

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
      socket.disconnect();
    };
  }, [isHostAvailable, activeBooking, user, hostProfile, radiusKm, setActiveBooking]);

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
    } catch (err) { 
      setError('Failed to send offer: ' + (err.response?.data?.error || err.message)); 
    } finally { setLoading(false); }
  };

  const startSession = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/start', { bookingId: activeBooking.id, otp: otpInput });
      setActiveBooking(res.data.booking);
      setOtpInput('');
    } catch (err) { 
      setError(err.response?.data?.error || 'Invalid Start OTP. Please check the code.'); 
    } finally { setLoading(false); }
  };

  const stopSession = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.post('/api/stop', { bookingId: activeBooking.id, otp: otpInput });
      setActiveBooking({ ...activeBooking, status: 'COMPLETED', finalAmount: res.data.finalAmount });
      setElapsedSeconds(0);
    } catch (err) { 
      setError(err.response?.data?.error || 'Invalid Stop OTP. Please check the code.'); 
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

  if (activeBooking) {
    return (
      <div className="p-4 pb-28 space-y-4">
        <h2 className="text-2xl font-bold text-white">Active Charging Session</h2>
        {error && <div className="p-3 text-sm text-red-400 bg-red-900/50 border border-red-800 rounded-lg animate-pulse">{error}</div>}
        
        <Card className="text-center py-8">
          <p className="text-sm text-gray-400 mb-4">Vehicle: <span className="text-white font-bold">{activeBooking.userId}</span></p>
          
          {(activeBooking.status === 'BOOKED' || activeBooking.status === 'CONFIRMED') ? (
            <>
              <p className="text-xs text-gray-500 mb-2">Driver is arriving. Ask them for the Start OTP.</p>
              <Input placeholder="Enter Start OTP" value={otpInput} onChange={e => setOtpInput(e.target.value)} className="text-center text-3xl tracking-widest font-mono mb-4" />
              <Button onClick={startSession} disabled={loading}>{loading ? 'Verifying...' : 'Verify & Start Charge'}</Button>
            </>
          ) : activeBooking.status === 'COMPLETED' ? (
            <>
              <div className="my-6">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Total Earned</p>
                <p className="text-5xl text-green-400 font-black mb-4">${activeBooking.finalAmount}</p>
              </div>
              <Button onClick={() => setActiveBooking(null)}>Return to Dashboard</Button>
            </>
          ) : (
            <>
              <div className="my-6">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Current Earnings</p>
                <p className="text-5xl text-green-400 font-black mb-4">${currentEarnings}</p>
                <p className="text-3xl font-mono text-white mb-2">{formatTime(elapsedSeconds)}</p>
              </div>
              <p className="text-xs text-gray-500 mb-2">Ask driver for End OTP to finish.</p>
              <Input placeholder="Enter End OTP" value={otpInput} onChange={e => setOtpInput(e.target.value)} className="text-center text-3xl tracking-widest font-mono mb-4" />
              <Button variant="danger" onClick={stopSession} disabled={loading}>{loading ? 'Stopping...' : 'Verify & Stop Charge'}</Button>
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
              <Button onClick={() => acceptRequest(req.id)} disabled={loading} className="w-auto px-6">{loading ? 'Sending...' : 'Offer Charge'}</Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}