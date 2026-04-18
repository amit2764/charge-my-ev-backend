import React, { useState } from 'react';
import { Input, Select, Button } from './UI';

export default function CreateEmployee() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'SUPPORT_AGENT',
    password: ''
  });

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    const pass = Array.from({length: 12}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    setFormData({ ...formData, password: pass });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Mock API call: axios.post('/api/admin/employees', formData)
    alert(`Successfully created employee account for ${formData.email} as ${formData.role}!`);
    setFormData({ name: '', email: '', role: 'SUPPORT_AGENT', password: '' });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Provision New Employee</h1>
      
      <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
        <form onSubmit={handleSubmit}>
          <Input label="Full Name" placeholder="e.g. Jane Doe" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
          <Input label="Corporate Email" type="email" placeholder="jane@chargemyev.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
          
          <Select label="System Role" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
            <option value="SUPER_ADMIN">Super Admin (Full Access)</option>
            <option value="OPS_MANAGER">Operations Manager</option>
            <option value="SUPPORT_AGENT">Support Agent (Users & Disputes)</option>
            <option value="READ_ONLY">Read-Only Observer</option>
          </Select>

          <div className="flex items-end gap-2">
            <div className="flex-1"><Input label="Temporary Password" type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required /></div>
            <Button type="button" variant="outline" className="mb-4 whitespace-nowrap" onClick={generatePassword}>Generate Secure</Button>
          </div>

          <Button type="submit" className="w-full mt-4">Create Employee Account</Button>
        </form>
      </div>
    </div>
  );
}