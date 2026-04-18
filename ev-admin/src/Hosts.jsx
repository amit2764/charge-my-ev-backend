import React, { useState } from 'react';
import { Table, Badge, Button } from './UI';

export default function Hosts() {
  const [hosts, setHosts] = useState([
    { id: 'hst_01', name: 'Alice Charging', location: 'Downtown', rating: 4.8, earnings: '$450', availability: 'ONLINE', status: 'ACTIVE' },
    { id: 'hst_02', name: 'Bob Station', location: 'Uptown', rating: 3.2, earnings: '$120', availability: 'OFFLINE', status: 'ACTIVE' },
    { id: 'hst_03', name: 'Charlie Hub', location: 'Westside', rating: 4.9, earnings: '$890', availability: 'OFFLINE', status: 'DISABLED' }
  ]);

  const toggleStatus = (id, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    if (window.confirm(`Are you sure you want to ${newStatus.toLowerCase()} this host?`)) {
      setHosts(hosts.map(h => h.id === id ? { ...h, status: newStatus } : h));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Host Management</h1>
      <Table headers={['Host ID', 'Name', 'Location', 'Rating', 'Earnings', 'Availability', 'Status', 'Actions']}>
        {hosts.map(h => (
          <tr key={h.id} className={`hover:bg-gray-50 ${h.status === 'DISABLED' ? 'opacity-60' : ''}`}>
            <td className="px-4 py-3 font-mono text-xs text-gray-500">{h.id}</td>
            <td className="px-4 py-3 font-semibold">{h.name}</td>
            <td className="px-4 py-3">{h.location}</td>
            <td className="px-4 py-3 font-medium">⭐ {h.rating}</td>
            <td className="px-4 py-3 font-bold text-green-600">{h.earnings}</td>
            <td className="px-4 py-3">
              <span className={`px-2 py-1 text-xs font-bold rounded-full ${h.availability === 'ONLINE' ? 'bg-cyan-100 text-cyan-800' : 'bg-gray-100 text-gray-600'}`}>{h.availability}</span>
            </td>
            <td className="px-4 py-3"><Badge status={h.status === 'ACTIVE' ? 'ACTIVE' : 'FAILED'} /></td>
            <td className="px-4 py-3">
              <Button variant={h.status === 'ACTIVE' ? 'danger' : 'primary'} size="sm" onClick={() => toggleStatus(h.id, h.status)}>
                {h.status === 'ACTIVE' ? 'Disable Host' : 'Enable Host'}
              </Button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}