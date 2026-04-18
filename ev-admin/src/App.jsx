
import React, { useState } from 'react';
import { useAdminStore } from './store';
import LiveSessions from './LiveSessions';
import Disputes from './Disputes';
import EmployeeManagement from './EmployeeManagement';
import CreateEmployee from './CreateEmployee';
import Users from './Users';
import Hosts from './Hosts';
import ManualMatching from './ManualMatching';
import { Card, Button, Input } from './UI';
import axios from 'axios';

const LOCAL_API_URL = 'http://localhost:3000';
const remoteApiUrl = import.meta.env.VITE_API_BASE_URL;
const localHosts = ['localhost', '127.0.0.1', '[::1]'];
const isLocalDev = typeof window !== 'undefined' && (
  localHosts.includes(window.location.hostname) ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.endsWith('.local')
);
const API_BASE_URL = isLocalDev ? LOCAL_API_URL : (remoteApiUrl || window.location.origin);

// Secure Login Screen
const AdminLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const login = useAdminStore(state => state.login);
  
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const res = await axios.post(`${API_BASE_URL}/api/admin/login`, { email, password });
      if (res.data.success) {
        login(res.data.user, res.data.role, res.data.token);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid credentials. Access denied.');
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-96 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Promoter Portal</h1>
          <p className="text-gray-500 text-sm">Strictly authorized personnel only.</p>
        </div>
        
        {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded text-center">{error}</div>}

        <form onSubmit={handleLogin} className="space-y-2">
          <Input label="Corporate Email" type="email" placeholder="admin@chargemyev.com" value={email} onChange={e => setEmail(e.target.value)} required />
          <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          <Button type="submit" className="w-full mt-2">Authenticate</Button>
        </form>
      </div>
    </div>
  );
};

// Overview Mock
const Overview = () => (
  <div className="p-6 max-w-7xl mx-auto space-y-6">
    <h1 className="text-2xl font-bold text-gray-900">System Overview</h1>
    <div className="grid grid-cols-4 gap-4">
      <Card title="Active Sessions" value="24" subtitle="+12% vs yesterday" />
      <Card title="Pending Requests" value="8" />
      <Card title="Total Hosts Online" value="142" />
      <Card title="Open Disputes" value="3" subtitle="Requires attention" />
    </div>
  </div>
);

export default function App() {
  const { adminUser, role, logout } = useAdminStore();
  const [activeRoute, setActiveRoute] = useState('overview');

  if (!adminUser) return <AdminLogin />;

  const navItems = [
    { id: 'overview', label: 'Overview', roles: ['SUPER_ADMIN', 'OPS_MANAGER', 'SUPPORT_AGENT', 'READ_ONLY'] },
    { id: 'sessions', label: 'Live Sessions', roles: ['SUPER_ADMIN', 'OPS_MANAGER', 'SUPPORT_AGENT', 'READ_ONLY'] },
    { id: 'manual_match', label: 'Manual Matching', roles: ['SUPER_ADMIN', 'OPS_MANAGER'] },
    { id: 'disputes', label: 'Dispute Center', roles: ['SUPER_ADMIN', 'SUPPORT_AGENT'] },
    { id: 'users', label: 'User Management', roles: ['SUPER_ADMIN', 'SUPPORT_AGENT'] },
    { id: 'hosts', label: 'Host Management', roles: ['SUPER_ADMIN', 'OPS_MANAGER'] },
    { id: 'emp_manage', label: 'Manage Employees', roles: ['SUPER_ADMIN'] },
    { id: 'emp_create', label: 'Provision Account', roles: ['SUPER_ADMIN'] },
  ];

  const visibleNav = navItems.filter(item => item.roles.includes(role));

  const renderContent = () => {
    switch(activeRoute) {
      case 'overview': return <Overview />;
      case 'sessions': return <LiveSessions />;
      case 'manual_match': return <ManualMatching />;
      case 'disputes': return <Disputes />;
      case 'users': return <Users />;
      case 'hosts': return <Hosts />;
      case 'emp_manage': return <EmployeeManagement />;
      case 'emp_create': return <CreateEmployee />;
      default: return <div className="p-6">Screen under construction.</div>;
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-gray-900">
      {/* Sidebar */}
      <div className="w-64 bg-gray-900 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-blue-400">Charge My EV</h2>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">{role.replace('_', ' ')}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {visibleNav.map(nav => (
            <button key={nav.id} onClick={() => setActiveRoute(nav.id)}
              className={`w-full text-left px-4 py-2.5 rounded text-sm font-medium transition-colors ${activeRoute === nav.id ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>
              {nav.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button onClick={logout} className="w-full px-4 py-2 text-sm text-red-400 hover:bg-gray-800 rounded text-left">Sign Out</button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">{renderContent()}</main>
    </div>
  );
}
