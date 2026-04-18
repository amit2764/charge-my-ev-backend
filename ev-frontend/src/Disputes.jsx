import React, { useState } from 'react';
import { Table, Badge, Button } from '../components/UI';
import { useAdminStore } from '../store';

export default function Disputes() {
  const { role } = useAdminStore();
  const canResolve = ['SUPER_ADMIN', 'SUPPORT_AGENT'].includes(role);
  
  const [disputes, setDisputes] = useState([
    { id: 'disp_001', session: 'sess_882', user: '+1234', host: 'Host C', issue: 'Cash payment not received', status: 'DISPUTED' },
    { id: 'disp_002', session: 'sess_815', user: '+9988', host: 'Host A', issue: 'Charger was broken', status: 'DISPUTED' }
  ]);

  const handleResolve = (id, penalty) => {
    // axios.post(`/api/admin/payment/${session}/resolve`, { resolution, penalties })
    alert(`Dispute ${id} resolved. Penalty applied: ${penalty}`);
    setDisputes(disputes.filter(d => d.id !== id));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dispute Management</h1>
      
      <Table headers={['Dispute ID', 'Session', 'User', 'Host', 'Issue Type', 'Status', 'Resolution Actions']}>
        {disputes.map(d => (
          <tr key={d.id} className="hover:bg-gray-50">
            <td className="px-4 py-3 font-mono text-xs">{d.id}</td>
            <td className="px-4 py-3 text-blue-600 underline cursor-pointer">{d.session}</td>
            <td className="px-4 py-3">{d.user}</td>
            <td className="px-4 py-3">{d.host}</td>
            <td className="px-4 py-3 text-red-600 font-medium">{d.issue}</td>
            <td className="px-4 py-3"><Badge status={d.status} /></td>
            <td className="px-4 py-3">
              {canResolve ? (
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={() => handleResolve(d.id, 'None')}>Resolve (No Penalty)</Button>
                  <Button variant="danger" size="sm" onClick={() => handleResolve(d.id, 'Host Trust -10')}>Penalize Host</Button>
                  <Button variant="danger" size="sm" onClick={() => handleResolve(d.id, 'User Trust -10')}>Penalize User</Button>
                </div>
              ) : (
                <span className="text-gray-400 text-xs">View Only</span>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}