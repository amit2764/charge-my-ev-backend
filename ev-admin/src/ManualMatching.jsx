import React, { useState } from 'react';
import { Table, Badge, Button } from './UI';

export default function ManualMatching() {
  const [requests, setRequests] = useState([
    { id: 'req_001', user: '+1234567890', location: 'Downtown', vehicle: 'Tesla Model 3', status: 'PENDING' }
  ]);
  
  const [hosts] = useState([
    { id: 'hst_01', name: 'Alice Charging', distance: '1.2 km', price: '$5/hr', rating: 4.8 },
    { id: 'hst_02', name: 'Charlie Station', distance: '3.5 km', price: '$4/hr', rating: 4.5 }
  ]);

  const handleAssign = (reqId, hostId) => {
    if(window.confirm(`Force assign Request ${reqId} to Host ${hostId}?`)) {
      setRequests(requests.filter(r => r.id !== reqId));
      alert('Successfully force-assigned host. The user will be notified immediately.');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Manual Matching</h1>
      <p className="text-gray-500">Override the auto-matcher and assign hosts directly to stranded users.</p>
      
      {requests.length === 0 ? (
        <div className="text-center py-16 text-gray-500 bg-white rounded-lg border border-gray-200 shadow-sm">
          No pending charging requests currently require manual intervention.
        </div>
      ) : requests.map(req => (
        <div key={req.id} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
          <div className="flex justify-between items-start border-b pb-4">
            <div>
              <h3 className="font-bold text-lg text-gray-900">Request {req.id}</h3>
              <p className="text-sm text-gray-600">User: {req.user} • Location: {req.location} • Vehicle: {req.vehicle}</p>
            </div>
            <Badge status={req.status} />
          </div>
          
          <h4 className="font-semibold text-gray-700 mt-4">Available Nearby Hosts</h4>
          <Table headers={['Host ID', 'Name', 'Distance', 'Price', 'Rating', 'Action']}>
            {hosts.map(h => (
              <tr key={h.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{h.id}</td>
                <td className="px-4 py-3 font-semibold">{h.name}</td>
                <td className="px-4 py-3">{h.distance}</td>
                <td className="px-4 py-3 font-medium text-green-600">{h.price}</td>
                <td className="px-4 py-3">⭐ {h.rating}</td>
                <td className="px-4 py-3">
                  <Button size="sm" onClick={() => handleAssign(req.id, h.id)}>Assign to User</Button>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      ))}
    </div>
  );
}