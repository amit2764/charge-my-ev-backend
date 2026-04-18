import React, { useState } from 'react';
import { Table, Badge, Button } from './UI';

export default function Users() {
  const [users, setUsers] = useState([
    { id: 'usr_01', name: 'John Doe', phone: '+1234567890', trustScore: 95, sessions: 12, reliability: '100%', status: 'ACTIVE' },
    { id: 'usr_02', name: 'Jane Smith', phone: '+0987654321', trustScore: 45, sessions: 3, reliability: '50%', status: 'BLOCKED' }
  ]);

  const toggleStatus = (id, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    if (window.confirm(`Are you sure you want to ${newStatus.toLowerCase()} this user?`)) {
      setUsers(users.map(u => u.id === id ? { ...u, status: newStatus } : u));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
      <Table headers={['User ID', 'Name', 'Phone', 'Trust Score', 'Sessions', 'Reliability', 'Status', 'Actions']}>
        {users.map(u => (
          <tr key={u.id} className={`hover:bg-gray-50 ${u.status === 'BLOCKED' ? 'opacity-60' : ''}`}>
            <td className="px-4 py-3 font-mono text-xs text-gray-500">{u.id}</td>
            <td className="px-4 py-3 font-semibold">{u.name}</td>
            <td className="px-4 py-3">{u.phone}</td>
            <td className={`px-4 py-3 font-bold ${u.trustScore > 80 ? 'text-green-600' : 'text-red-600'}`}>{u.trustScore}</td>
            <td className="px-4 py-3">{u.sessions}</td>
            <td className="px-4 py-3">{u.reliability}</td>
            <td className="px-4 py-3"><Badge status={u.status === 'ACTIVE' ? 'ACTIVE' : 'FAILED'} /></td>
            <td className="px-4 py-3">
              <Button variant={u.status === 'ACTIVE' ? 'danger' : 'primary'} size="sm" onClick={() => toggleStatus(u.id, u.status)}>
                {u.status === 'ACTIVE' ? 'Block User' : 'Unblock User'}
              </Button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}