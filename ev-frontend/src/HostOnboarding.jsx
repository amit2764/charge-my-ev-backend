import React, { useState } from 'react';
import { useStore } from './store';
import { Card, Input, Button } from './components';

export default function HostOnboarding() {
  const { setHostProfile } = useStore();
  const [formData, setFormData] = useState({
    address: '',
    landmark: '',
    chargerType: 'Level 2 (7kW)',
    pricePerHour: '15.00',
    location: null
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const captureLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setFormData({ ...formData, location: { lat: pos.coords.latitude, lng: pos.coords.longitude } }),
        (err) => setError('Could not access GPS. Please ensure location services are enabled.')
      );
    } else {
      setError('Geolocation is not supported by your browser.');
    }
  };

  const handleSubmit = async () => {
    setLoading(true); setError('');
    try {
      // In production: await api.post('/api/hosts', formData);
      await new Promise(resolve => setTimeout(resolve, 800));
      setHostProfile({ ...formData, isActive: true });
    } catch (err) {
      setError('Failed to save your host profile. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 pb-28 space-y-6">
      <div className="text-center mb-6 mt-4">
        <h2 className="text-3xl font-black text-white mb-2">Become a Host</h2>
        <p className="text-gray-400">Share your charger and start earning.</p>
      </div>

      <Card className="space-y-2">
        {error && <div className="p-3 mb-4 text-sm text-red-400 bg-red-900/50 border border-red-800 rounded-lg">{error}</div>}
        
        <div className="flex items-end gap-2 mb-2">
          <div className="flex-1">
            <Input label="GPS Coordinates" value={formData.location ? `${formData.location.lat.toFixed(4)}, ${formData.location.lng.toFixed(4)}` : 'Not set'} disabled />
          </div>
          <Button type="button" variant="outline" className="mb-4 whitespace-nowrap" onClick={captureLocation}>📍 Get GPS</Button>
        </div>

        <Input label="Charger Address" placeholder="123 Main St, City" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
        <Input label="Landmark (Optional)" placeholder="Near the blue gate" value={formData.landmark} onChange={e => setFormData({...formData, landmark: e.target.value})} />
        <Input label="Charger Type & Speed" placeholder="e.g. Level 2 (7kW)" value={formData.chargerType} onChange={e => setFormData({...formData, chargerType: e.target.value})} />
        <Input label="Price Per Hour ($)" type="number" placeholder="15.00" value={formData.pricePerHour} onChange={e => setFormData({...formData, pricePerHour: e.target.value})} />
        <Button onClick={handleSubmit} disabled={loading || !formData.address} className="mt-4">{loading ? 'Saving...' : 'Start Earning'}</Button>
      </Card>
    </div>
  );
}