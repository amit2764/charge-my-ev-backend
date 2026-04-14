import { useState, useEffect } from 'react';
import api from './api';
import { useStore } from './store';
import { Button, Card, Input } from './components';

export default function HostFlow() {
  const { user } = useStore();
  const [requests, setRequests] = useState([]);
  const [price, setPrice] = useState('5.00');

  // Mock fetching active requests (In reality, use Socket.io to listen for 'NEW_REQUEST')
  useEffect(() => {
    // For demo purposes, we will mock an incoming request
    setTimeout(() => {
      setRequests([{ id: 'req_demo', vehicleType: 'electric', location: { lat: 37.7, lng: -122.4 } }]);
    }, 3000);
  }, []);

  const acceptRequest = async (reqId) => {
    try {
      await api.post('/api/respond', { requestId: reqId, hostId: user, status: 'ACCEPTED', price: parseFloat(price), estimatedArrival: 5 });
      alert('Offer sent to driver!');
      setRequests(requests.filter(r => r.id !== reqId));
    } catch (err) { 
      alert('Failed to send offer: ' + (err.response?.data?.error || err.message)); 
    }
  };

  return (
    <div className="p-4 pb-28">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">Host Dashboard</h2>
        <p className="text-gray-400">Your charger is currently <span className="text-cyan-400 font-bold">Online</span></p>
      </div>

      <h3 className="font-bold text-white mb-3">Incoming Requests</h3>
      {requests.length === 0 ? (
        <Card className="text-center py-10 text-gray-500">No requests nearby right now.</Card>
      ) : (
        requests.map(req => (
          <Card key={req.id} className="mb-4">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="font-bold capitalize text-white">{req.vehicleType} EV</p>
                <p className="text-sm text-gray-400">2.5 km away</p>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3.5 top-3.5 text-gray-400">$</span>
                <Input type="number" value={price} onChange={e => setPrice(e.target.value)} className="pl-8 mb-0" />
              </div>
              <Button onClick={() => acceptRequest(req.id)} className="w-auto px-6">Offer Charge</Button>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}