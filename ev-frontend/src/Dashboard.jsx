import { useState, useEffect } from 'react';
import api from './api';
import './Dashboard.css';

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
    <div className="app-container">
      {/* Top Navigation */}
      <header className="app-header">
        <h2>Charge My EV</h2>
        <div className="user-profile">
          <span className="phone-badge">{user.slice(-4)}</span>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </header>

      {/* Hero / Map Area */}
      <div className="map-hero">
        <h1>{chargers.length}</h1>
        <p>Chargers near you in San Francisco</p>
      </div>

      {/* Main Content */}
      <div className="content-section">
        <div className="section-title">
          <span>Nearby Stations</span>
          <button className="refresh-btn" onClick={fetchChargers}>Refresh</button>
        </div>

        {loading && <p style={{ color: '#86868b', textAlign: 'center' }}>Locating chargers...</p>}
        {error && <p style={{ color: '#FF3B30', textAlign: 'center' }}>{error}</p>}

        {chargers.map(charger => (
          <div className="charger-card" key={charger.id}>
            <div className="charger-header">
              <h3>{charger.name}</h3>
              <span className="distance-badge">{charger.distance} km</span>
            </div>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#86868b' }}>{charger.chargerType} • {charger.powerOutput}kW</p>
            <p style={{ margin: 0, fontWeight: '600', color: '#1D1D1F' }}>${charger.pricePerHour}/hr</p>
          </div>
        ))}
      </div>

      {/* Floating Action Button */}
      <div className="fab-container">
        <button className="fab-button" onClick={handleRequestCharge}>
          ⚡ Request Charge
        </button>
      </div>