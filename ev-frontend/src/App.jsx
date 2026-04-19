import React, { useEffect, useState } from 'react';
import { useStore } from './store';
import LoginScreen from './LoginScreen';
import UserFlow from './UserFlow';
import UserProfile from './UserProfile';
import UserHistory from './UserHistory';
import HostEarnings from './HostEarnings';
import HostFlow from './HostFlow';

export default function App() {
  const { user, role, setRole, logout, activeBooking, activeBookingRole } = useStore();
  const [activeTab, setActiveTab] = useState('charge');

  const isSessionLocked = !!(
    activeBooking &&
    (
      activeBooking.status === 'BOOKED' ||
      activeBooking.status === 'CONFIRMED' ||
      activeBooking.status === 'STARTED' ||
      (activeBooking.status === 'COMPLETED' && activeBooking.paymentStatus !== 'CONFIRMED')
    )
  );

  useEffect(() => {
    if (!isSessionLocked || !activeBookingRole || role === activeBookingRole) return;
    setRole(activeBookingRole);
  }, [isSessionLocked, activeBookingRole, role, setRole]);

  const effectiveTab = isSessionLocked && activeBookingRole
    ? (activeBookingRole === 'host' ? 'dashboard' : 'charge')
    : activeTab;

  const switchRole = (nextRole) => {
    if (isSessionLocked && activeBookingRole && nextRole !== activeBookingRole) {
      return;
    }
    setRole(nextRole);
    setActiveTab(nextRole === 'host' ? 'dashboard' : 'charge');
  };

  if (!user) return <LoginScreen />;

  return (
    <div className="max-w-md mx-auto bg-black text-gray-200 min-h-screen shadow-2xl shadow-cyan-500/10 relative overflow-hidden flex flex-col">
      
      {/* Global Mobile Header */}
      <header className="bg-black/80 backdrop-blur-lg px-4 py-3 flex justify-between items-center border-b border-gray-800 sticky top-0 z-10">
        
        {/* CRITICAL: Top-Level Role Toggle */}
        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
          <button
            onClick={() => switchRole('user')}
            disabled={isSessionLocked && activeBookingRole === 'host'}
            title={isSessionLocked && activeBookingRole === 'host' ? 'Active host session in progress. Finish it first.' : ''}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${role === 'user' ? 'bg-cyan-500 text-black shadow-sm' : 'text-gray-400 hover:text-gray-200'} ${isSessionLocked && activeBookingRole === 'host' ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            User Mode
          </button>
          <button
            onClick={() => switchRole('host')}
            disabled={isSessionLocked && activeBookingRole === 'user'}
            title={isSessionLocked && activeBookingRole === 'user' ? 'Active user session in progress. Finish it first.' : ''}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${role === 'host' ? 'bg-cyan-500 text-black shadow-sm' : 'text-gray-400 hover:text-gray-200'} ${isSessionLocked && activeBookingRole === 'user' ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            Host Mode
          </button>
        </div>

        <button onClick={logout} className="text-sm font-bold text-red-400 hover:text-red-300 transition">
          Logout
        </button>
      </header>

      {/* Dynamic Screen Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {role === 'user' ? (
          <>
            {effectiveTab === 'charge' && <UserFlow />}
            {effectiveTab === 'history' && <UserHistory />}
            {effectiveTab === 'profile' && <UserProfile />}
          </>
        ) : (
          <>
            {effectiveTab === 'dashboard' && <HostFlow />}
            {effectiveTab === 'earnings' && <HostEarnings />}
            {effectiveTab === 'profile' && <UserProfile />}
          </>
        )}
      </div>

      {/* Role Switcher (Bottom Nav) */}
      <div className="absolute bottom-0 w-full bg-black/80 backdrop-blur-lg border-t border-gray-800 flex">
        {role === 'user' ? (
          <>
            <button onClick={() => setActiveTab('charge')} className={`flex-1 py-4 font-bold text-sm transition ${effectiveTab === 'charge' ? 'text-cyan-400 border-t-2 border-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>⚡ Charge</button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-4 font-bold text-sm transition ${effectiveTab === 'history' ? 'text-cyan-400 border-t-2 border-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>🕒 History</button>
          </>
        ) : (
          <>
            <button onClick={() => setActiveTab('dashboard')} className={`flex-1 py-4 font-bold text-sm transition ${effectiveTab === 'dashboard' ? 'text-cyan-400 border-t-2 border-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>🏠 Dashboard</button>
            <button onClick={() => setActiveTab('earnings')} className={`flex-1 py-4 font-bold text-sm transition ${effectiveTab === 'earnings' ? 'text-cyan-400 border-t-2 border-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>💰 Earnings</button>
          </>
        )}
        <button onClick={() => setActiveTab('profile')} className={`flex-1 py-4 font-bold text-sm transition ${effectiveTab === 'profile' ? 'text-cyan-400 border-t-2 border-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}>👤 Profile</button>
      </div>
      
    </div>
  );
}