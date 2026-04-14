import { useState, useEffect } from 'react';
import api from './api';

export default function Dashboard({ user, onLogout }) {
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch nearby chargers when the dashboard loads
  const fetchChargers = async () => {
    setLoading(true);
    setError('');
    try {
      // We'll use default coordinates for now (San Francisco) to match our mock data
      const response = await api.get('/api/chargers/nearby?lat=37.7749&lng=-122.4194&radius=10');
      if (response.data.success) {
        setChargers(response.data.stations);
      }
    } catch (err) {
      setError('Failed to load nearby chargers.');
    } finally {
      setLoading(false);
    }
  };

  // Run the fetch function as soon as the component appears on screen
  useEffect(() => {
    fetchChargers();
  }, []);

  const handleRequestCharge = async () => {
    try {
      alert('Charging request sent! Waiting for nearby hosts to respond...');
      await api.post('/api/request', {
        userId: user,
        location: { lat: 37.7749, lng: -122.4194 },
        vehicleType: 'electric'
      });
    } catch (err) {
      alert('Failed to send request. Are you sure you are logged in?');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom: '2px solid #eee', paddingBottom: '10px' }}>
        <h2 style={{ margin: 0 }}>Charge My EV ⚡</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontWeight: 'bold', color: '#555' }}>{user}</span>
          <button onClick={onLogout} style={{ padding: '6px 12px', cursor: 'pointer', background: '#ffebee', color: '#c62828', border: '1px solid #ffcdd2', borderRadius: '4px' }}>Logout</button>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={fetchChargers} style={{ padding: '10px 20px', background: '#2E7D32', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          🔄 Refresh List
        </button>
        <button onClick={handleRequestCharge} style={{ padding: '10px 20px', background: '#1976D2', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
          ⚡ Request a Charge Here
        </button>
      </div>

      {loading && <p style={{ color: '#666' }}>Locating chargers near you...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '15px' }}>
        {chargers.map(charger => (
          <div key={charger.id} style={{ border: '1px solid #e0e0e0', padding: '20px', borderRadius: '12px', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>{charger.name}</h3>
            <p style={{ margin: '5px 0', color: '#555' }}><strong>📍 Distance:</strong> {charger.distance} km away</p>
            <p style={{ margin: '5px 0', color: '#555' }}><strong>🔌 Type:</strong> {charger.chargerType} ({charger.powerOutput}kW)</p>
            <p style={{ margin: '5px 0', color: '#555' }}><strong>💰 Price:</strong> ${charger.pricePerHour}/hr</p>
            <p style={{ margin: '10px 0 0 0', fontWeight: 'bold', color: charger.availability === 'AVAILABLE' ? '#2E7D32' : '#f57c00' }}>
              ● {charger.availability}
            </p>
          </div>
        ))}
        {!loading && chargers.length === 0 && <p>No chargers found nearby.</p>}
      </div>
    </div>
  );
}