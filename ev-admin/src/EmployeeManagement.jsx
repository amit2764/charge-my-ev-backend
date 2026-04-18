import React, { useState } from 'react';
import { Table, Badge, Button } from './UI';

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([
    { id: 'emp_01', name: 'Alice Walker', email: 'alice@chargemyev.com', role: 'SUPER_ADMIN', status: 'ACTIVE' },
    { id: 'emp_02', name: 'Bob Smith', email: 'bob@chargemyev.com', role: 'OPS_MANAGER', status: 'ACTIVE' },
    { id: 'emp_03', name: 'Charlie Davis', email: 'charlie@chargemyev.com', role: 'SUPPORT_AGENT', status: 'DISABLED' },
  ]);

  const toggleStatus = (id, currentStatus) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    if (window.confirm(`Are you sure you want to ${newStatus === 'DISABLED' ? 'disable' : 'enable'} this employee?`)) {
      setEmployees(employees.map(emp => emp.id === id ? { ...emp, status: newStatus } : emp));
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('CRITICAL WARNING: Are you sure you want to permanently delete this employee account?')) {
      setEmployees(employees.filter(emp => emp.id !== id));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
      </div>
      
      <Table headers={['ID', 'Name', 'Email', 'Role', 'Status', 'Actions']}>
        {employees.map(emp => (
          <tr key={emp.id} className={`hover:bg-gray-50 ${emp.status === 'DISABLED' ? 'opacity-50' : ''}`}>
            <td className="px-4 py-3 font-mono text-xs text-gray-500">{emp.id}</td>
            <td className="px-4 py-3 font-semibold">{emp.name}</td>
            <td className="px-4 py-3">{emp.email}</td>
            <td className="px-4 py-3">
              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-bold">{emp.role}</span>
            </td>
            <td className="px-4 py-3">
              <Badge status={emp.status === 'ACTIVE' ? 'ACTIVE' : 'FAILED'} />
            </td>
            <td className="px-4 py-3 flex gap-2">
              <Button variant="outline" size="sm">Reset Password</Button>
              <Button variant="outline" size="sm" onClick={() => toggleStatus(emp.id, emp.status)}>
                {emp.status === 'ACTIVE' ? 'Disable' : 'Enable'}
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(emp.id)}>Delete</Button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}