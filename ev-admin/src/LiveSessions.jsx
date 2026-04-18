import React, { useState, useEffect } from 'react';
import { Table, Badge, Button } from './UI';
import { useAdminStore } from './store';

export default function LiveSessions() {
  const { role } = useAdminStore();
  const [sessions, setSessions] = useState([]);
  const hasActionAccess = ['SUPER_ADMIN', 'OPS_MANAGER'].includes(role);

  useEffect(() => {
    // Poll active sessions every 10 seconds
    const fetchSessions = () => {
      // Mock API call: axios.get('/api/admin/sessions/active', { headers: { Authorization: token } })
      setSessions([
        { id: 'sess_9021', user: '+1234567890', host: 'Host A (Downtown)', startTime: '10:45 AM', duration: '45m', status: 'ACTIVE' },
        { id: 'sess_9022', user: '+0987654321', host: 'Host B (Uptown)', startTime: '11:10 AM', duration: '20m', status: 'ACTIVE' },
      ]);
    };
    
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleForceEnd = (id) => {
    if (window.confirm(`Are you sure you want to FORCE END session ${id}?`)) {
      alert(`Session ${id} forcefully terminated by operator.`);
      setSessions(sessions.filter(s => s.id !== id));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Live Charging Sessions</h1>
        <span className="text-sm text-gray-500">Auto-updating every 10s</span>
      </div>
      
      <Table headers={['Session ID', 'User', 'Host', 'Start Time', 'Duration', 'Status', 'Actions']}>
        {sessions.map(s => (
          <tr key={s.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-mono text-xs">{s.id}</td>
            <td className="px-4 py-3">{s.user}</td>
            <td className="px-4 py-3">{s.host}</td>
            <td className="px-4 py-3">{s.startTime}</td>
            <td className="px-4 py-3 font-semibold">{s.duration}</td>
            <td className="px-4 py-3"><Badge status={s.status} /></td>
            <td className="px-4 py-3 flex gap-2">
              {hasActionAccess && <Button variant="danger" size="sm" onClick={() => handleForceEnd(s.id)}>Force End</Button>}
              <Button variant="outline" size="sm">Flag</Button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}