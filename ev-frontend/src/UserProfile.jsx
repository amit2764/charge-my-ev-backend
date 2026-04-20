import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import { Card, Input, Button, Select } from './components';
import api from './api';
import useReport from './hooks/useReport';
import KYCScreen from './screens/KYCScreen';
import VerifiedBadge from './components/VerifiedBadge';

export default function UserProfile() {
  const { user, role, userProfile, setUserProfile } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [showKycScreen, setShowKycScreen] = useState(false);
  const [formData, setFormData] = useState({ name: 'EV Owner', vehicleType: 'Tata Nexon EV', connectorType: 'CCS2', location: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trustData, setTrustData] = useState(null);
  const [kycStatus, setKycStatus] = useState('UNVERIFIED');
  const [kycReason, setKycReason] = useState('');
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const { unblockUser, getBlockedUsers } = useReport();

  useEffect(() => {
    // Load existing profile from store or defaults
    if (userProfile) setFormData(userProfile);
    
    // Fetch live trust score from backend
    const fetchTrustScore = async () => {
      try {
        // encodeURIComponent ensures the '+' in the phone number doesn't break the URL
        const res = await api.get(`/api/trust-score/${encodeURIComponent(user)}`);
        if (res.data.success) setTrustData(res.data.profile);
      } catch (err) { 
        if (err.response?.status === 404) {
          console.log('New user detected: No trust profile found yet. Using default score.');
        } else {
          console.error('Failed to load trust score', err); 
        }
      }
    };
    fetchTrustScore();
  }, [user, userProfile]);

  useEffect(() => {
    const fetchKycStatus = async () => {
      if (!user) return;
      try {
        const res = await api.get(`/api/kyc/status?userId=${encodeURIComponent(user)}`);
        const kyc = res.data?.kyc || {};
        setKycStatus(String(kyc.status || 'UNVERIFIED').toUpperCase());
        setKycReason(String(kyc.rejectionReason || ''));
      } catch {
        setKycStatus('UNVERIFIED');
      }
    };

    fetchKycStatus();
  }, [user]);

  useEffect(() => {
    const loadBlockedUsers = async () => {
      if (role !== 'host' || !user) return;
      setBlockedLoading(true);
      const blocks = await getBlockedUsers({ hostId: user });
      setBlockedUsers(blocks);
      setBlockedLoading(false);
    };

    loadBlockedUsers();
  }, [role, user]);

  const handleUnblock = async (blockedUserId) => {
    try {
      await unblockUser({ hostId: user, blockedUserId });
      const blocks = await getBlockedUsers({ hostId: user });
      setBlockedUsers(blocks);
    } catch (err) {
      setError(err.message || 'Failed to unblock user');
    }
  };

  const captureLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setFormData({ ...formData, location: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
        () => setError('Could not access GPS.')
      );
    }
  };

  const handleSave = async () => {
    setLoading(true); setError('');
    try {
      // In a fully integrated app, you would send this to the backend:
      // await api.put(`/api/users/${encodeURIComponent(user)}`, formData);
      
      // Simulate network request
      await new Promise(resolve => setTimeout(resolve, 600));
      setUserProfile(formData);
      setIsEditing(false);
    } catch {
      setError('Failed to save profile. Please try again.');
    } finally { setLoading(false); }
  };

  if (showKycScreen) {
    return (
      <div className="p-4 pb-28">
        <KYCScreen
          onBack={() => setShowKycScreen(false)}
          onStatusChange={(nextKyc) => {
            setKycStatus(String(nextKyc?.status || 'UNVERIFIED').toUpperCase());
            setKycReason(String(nextKyc?.rejectionReason || ''));
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 pb-28 space-y-6">
      <div className="flex justify-between items-end">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-gradient-to-br from-blue-500/30 to-emerald-400/20 text-xl font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            {String(formData.name || user || 'U').slice(0, 1).toUpperCase()}
          </div>
          <div className="flex items-center gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Screen 5</p>
              <h2 className="text-2xl font-black text-white">Your Profile</h2>
            </div>
          {kycStatus === 'VERIFIED' && <VerifiedBadge />}
          </div>
        </div>
        {!isEditing && <button onClick={() => setIsEditing(true)} className="glass-surface rounded-[18px] px-4 py-2 text-cyan-300 font-semibold">Edit</button>}
      </div>

      {/* Trust Score Banner */}
      <div className="glass-surface overflow-hidden rounded-[28px] border border-blue-400/12 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.2),transparent_40%),linear-gradient(135deg,rgba(15,23,42,0.9),rgba(17,24,39,0.82))] p-5 shadow-[0_24px_60px_rgba(59,130,246,0.16)]">
        <div className="flex justify-between items-center gap-4">
        <div>
          <p className="text-cyan-100 text-sm font-semibold mb-1">Trust Score</p>
          <p className="premium-number text-4xl font-black text-white">{trustData?.trustScore || 85}<span className="text-lg text-cyan-400">/100</span></p>
        </div>
        <div className="text-right">
          <p className="text-cyan-100 text-sm font-semibold mb-1">Reliability</p>
          <p className="text-xl font-bold text-white">{trustData?.metrics?.paymentReliability || 100}%</p>
        </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-[20px] bg-white/5 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Identity</p>
            <p className="mt-1 text-sm font-bold text-white">{kycStatus}</p>
          </div>
          <div className="rounded-[20px] bg-white/5 px-4 py-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Role</p>
            <p className="mt-1 text-sm font-bold text-white capitalize">{role}</p>
          </div>
        </div>
      </div>

      <Card>
        {error && <div className="p-3 mb-4 text-sm text-red-400 bg-red-900/50 border border-red-800 rounded-lg">{error}</div>}
        
        {isEditing ? (
          <div className="space-y-2">
            <Input label="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <Select
              label="Vehicle Model"
              value={formData.vehicleType}
              onChange={e => setFormData({...formData, vehicleType: e.target.value})}
              options={['Tata Nexon EV','Tata Tigor EV','MG ZS EV','Hyundai IONIQ 5','Kia EV6','Tesla Model 3','Tesla Model Y','Tesla Model S','Tesla Model X','BMW i4','Audi e-tron','Mahindra XUV400','Ola S1 Pro (2W)','Ather 450X (2W)','Other']}
            />
            <Select
              label="Charging Port (Connector Type)"
              value={formData.connectorType}
              onChange={e => setFormData({...formData, connectorType: e.target.value})}
              options={['Type 1 (J1772)','Type 2 (Mennekes)','CCS1','CCS2','CHAdeMO','GB/T','Bharat AC-001','Bharat DC-001']}
            />
            <div className="flex items-end gap-2">
              <div className="flex-1"><Input label="Default GPS" value={formData.location ? `${formData.location.lat.toFixed(4)}, ${formData.location.lng.toFixed(4)}` : 'Not set'} disabled /></div>
              <Button variant="outline" className="mb-4 whitespace-nowrap" onClick={captureLocation}>📍 Get GPS</Button>
            </div>
            <Button onClick={handleSave} disabled={loading} className="mt-4">{loading ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div><p className="text-sm text-gray-500 font-semibold">Phone Number</p><p className="text-lg text-white">{user}</p></div>
            <div><p className="text-sm text-gray-500 font-semibold">Name</p><p className="text-lg text-white">{formData.name}</p></div>
            <div><p className="text-sm text-gray-500 font-semibold">Vehicle</p><p className="text-lg text-white">{formData.vehicleType}</p></div>
            <div><p className="text-sm text-gray-500 font-semibold">Connector</p><p className="text-lg text-white">{formData.connectorType || 'CCS2'}</p></div>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="mb-2 text-base font-bold text-cyan-300">Identity verification</h3>
        <p className="text-sm text-gray-300">Status: <span className="font-semibold text-white">{kycStatus}</span></p>
        {kycStatus === 'REJECTED' && !!kycReason && (
          <p className="mt-2 rounded-lg border border-red-700 bg-red-900/30 px-3 py-2 text-xs text-red-300">Reason: {kycReason}</p>
        )}
        {kycStatus !== 'VERIFIED' && (
          <Button className="mt-3" onClick={() => setShowKycScreen(true)}>
            {kycStatus === 'REJECTED' ? 'Re-submit verification' : 'Get verified'}
          </Button>
        )}
      </Card>

      {role === 'host' && (
        <Card>
          <h3 className="mb-3 text-base font-bold text-cyan-300">Blocked Users</h3>
          {blockedLoading && <p className="text-sm text-gray-400">Loading blocked users...</p>}
          {!blockedLoading && blockedUsers.length === 0 && (
            <p className="text-sm text-gray-400">No blocked users.</p>
          )}
          <div className="space-y-2">
            {blockedUsers.map((entry) => (
              <div key={entry.blockId || entry.blockedUserId} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-white">{entry.displayName || entry.blockedUserId}</p>
                  <p className="text-xs text-gray-400">{entry.blockedUserId}</p>
                </div>
                <Button
                  variant="outline"
                  className="w-auto px-3 py-2 text-sm"
                  onClick={() => handleUnblock(entry.blockedUserId)}
                >
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}