import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import { Card, Input, Button } from './components';
import api from './api';

export default function UserProfile() {
  const { user, userProfile, setUserProfile } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: 'EV Owner', vehicleType: 'Tesla Model 3', location: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trustData, setTrustData] = useState(null);

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

  const captureLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setFormData({ ...formData, location: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
        (err) => setError('Could not access GPS.')
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
    } catch (err) {
      setError('Failed to save profile. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 pb-28 space-y-6">
      <div className="flex justify-between items-end">
        <h2 className="text-2xl font-bold text-white">Your Profile</h2>
        {!isEditing && <button onClick={() => setIsEditing(true)} className="text-cyan-400 font-semibold">Edit</button>}
      </div>

      {/* Trust Score Banner */}
      <div className="bg-gradient-to-r from-cyan-900 to-blue-900 p-5 rounded-2xl border border-cyan-800 flex justify-between items-center shadow-lg shadow-cyan-900/20">
        <div>
          <p className="text-cyan-100 text-sm font-semibold mb-1">Trust Score</p>
          <p className="text-3xl font-black text-white">{trustData?.trustScore || 85}<span className="text-lg text-cyan-400">/100</span></p>
        </div>
        <div className="text-right">
          <p className="text-cyan-100 text-sm font-semibold mb-1">Reliability</p>
          <p className="text-xl font-bold text-white">{trustData?.metrics?.paymentReliability || 100}%</p>
        </div>
      </div>

      <Card>
        {error && <div className="p-3 mb-4 text-sm text-red-400 bg-red-900/50 border border-red-800 rounded-lg">{error}</div>}
        
        {isEditing ? (
          <div className="space-y-2">
            <Input label="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <Input label="Vehicle Model" value={formData.vehicleType} onChange={e => setFormData({...formData, vehicleType: e.target.value})} />
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
          </div>
        )}
      </Card>
    </div>
  );
}