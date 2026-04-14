import { useState, useEffect } from 'react';
import api from './api';
import { socket } from './socket';
import { useStore } from './store';
import { Button, Card, Input } from './components';

export default function UserFlow() {
  const { user, activeRequest, setActiveRequest, activeBooking, setActiveBooking } = useStore();
  const [step, setStep] = useState('REQUEST'); // REQUEST, MATCHING, CHARGING, PAYMENT
  const [hosts, setHosts] = useState([]);
  const [otpInput, setOtpInput] = useState('');

  useEffect(() => {
    socket.connect();
    socket.on('response_update', (data) => {
      if (data.action === 'added') setHosts(prev => [...prev, data.response]);
    });
    return () => socket.disconnect();
  }, []);

  const createRequest = async () => {
    try {
      const res = await api.post('/api/request', { userId: user, location: { lat: 37.77, lng: -122.41 }, vehicleType: 'electric' });
      setActiveRequest(res.data.request);
      socket.emit('subscribe', { userId: user, requestId: res.data.request.id });
      setStep('MATCHING');
    } catch (err) { 
      alert('Failed to create request: ' + (err.response?.data?.error || err.message)); 
    }
  };

  const bookHost = async (host) => {
    try {
      const res = await api.post('/api/book', { userId: user, hostId: host.hostId, chargerId: 'charger1', price: host.price, requestId: activeRequest.id });
      setActiveBooking(res.data.booking);
      setStep('CHARGING');
    } catch (err) { alert('Booking failed'); }
  };

  const startCharging = async () => {
    try {
      const res = await api.post('/api/start', { bookingId: activeBooking.id, otp: otpInput });
      setActiveBooking(res.data.booking);
      setOtpInput('');
    } catch (err) { alert('Invalid Start OTP'); }
  };

  const stopCharging = async () => {
    try {
      const res = await api.post('/api/stop', { bookingId: activeBooking.id, otp: otpInput });
      setActiveBooking({ ...res.data.booking, finalAmount: res.data.finalAmount });
      setStep('PAYMENT');
    } catch (err) { alert('Invalid Stop OTP'); }
  };

  const payCash = async () => {
    try {
      await api.post('/api/payment/confirm', { bookingId: activeBooking.id, confirmerId: user, role: 'user', confirmed: true });
      alert('Payment Confirmed! Thank you.');
      setActiveBooking(null); setActiveRequest(null); setStep('REQUEST');
    } catch (err) { alert('Payment failed'); }
  };

  return (
    <div className="p-4 pb-28">
      {step === 'REQUEST' && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Find a Charger</h2>
          <Card>
            <p className="text-gray-400 mb-4">Location: Auto-detected (San Francisco)</p>
            <Button onClick={createRequest}>Search Nearby Hosts</Button>
          </Card>
        </div>
      )}

      {step === 'MATCHING' && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Available Hosts</h2>
          {hosts.length === 0 ? <p className="text-gray-500 text-center py-10 animate-pulse">Broadcasting your request to nearby hosts...</p> : null}
          {hosts.map(h => (
            <Card key={h.id} className="flex justify-between items-center">
              <div>
                <p className="font-bold text-lg text-white">${h.price}/hr</p>
                <p className="text-sm text-gray-400">ETA: {h.estimatedArrival} mins</p>
              </div>
              <Button onClick={() => bookHost(h)} className="w-auto px-8">Select</Button>
            </Card>
          ))}
        </div>
      )}

      {step === 'CHARGING' && activeBooking && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-white">Live Session</h2>
          <Card className="text-center py-8">
            <p className="text-sm text-gray-400 mb-2">Status: <span className="font-bold text-cyan-400">{activeBooking.status}</span></p>
            <Input placeholder="Enter OTP" value={otpInput} onChange={e => setOtpInput(e.target.value)} className="text-center text-3xl tracking-widest font-mono" />
            
            {activeBooking.status === 'BOOKED' ? 
              <Button onClick={startCharging}>Start Session</Button> : 
              <Button variant="danger" onClick={stopCharging}>Stop Charging</Button>
            }
          </Card>
        </div>
      )}

      {step === 'PAYMENT' && activeBooking && (
        <div className="space-y-4 text-center">
          <h2 className="text-2xl font-bold text-white">Session Complete</h2>
          <Card>
            <p className="text-5xl font-black text-white my-6">${activeBooking.finalAmount}</p>
            <Button onClick={payCash}>I Paid Cash</Button>
          </Card>
        </div>
      )}
    </div>
  );
}