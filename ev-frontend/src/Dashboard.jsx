import { useState, useEffect } from 'react';
import api from './api';
import { socket } from './socket';
import './Dashboard.css';

export default function Dashboard({ user, onLogout }) {
  const [chargers, setChargers] = useState([]);
  const [activeRequestId, setActiveRequestId] = useState(null);
  const [hostResponses, setHostResponses] = useState([]);
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
    } catch {
      setError('Failed to load nearby chargers.');
    } finally {
      setLoading(false);
    }
  };

  // Run the fetch function as soon as the component appears on screen
  useEffect(() => {
    fetchChargers();
  }, []);

  // Setup Socket.io connection when Dashboard loads
  useEffect(() => {
    // Listen for built-in Socket.io events to catch any hidden errors
    socket.on('connect', () => {
      console.log('✅ Walkie-talkie connected to server! ID:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Walkie-talkie connection failed:', err.message);
    });

    socket.connect();

    socket.on('connected', (data) => {
      console.log('🔌 Walkie-talkie connected:', data.message);
    });

    // Listen for live host responses!
    socket.on('response_update', (data) => {
      console.log('🔔 Live Host Response Received:', data);
      if (data.action === 'added' || data.action === 'modified') {
        setHostResponses((prev) => {
          const exists = prev.find(r => r.id === data.response.id);
          if (exists) return prev.map(r => r.id === data.response.id ? data.response : r);
          return [...prev, data.response];
        });
      }
    });

    return () => socket.disconnect(); // Turn off walkie-talkie when leaving page
  }, []);

  const handleRequestCharge = async () => {
    try {
      const response = await api.post('/api/request', {
        userId: user,
        location: { lat: 37.7749, lng: -122.4194 },
        vehicleType: 'electric'
      });

      if (response.data.success) {
        const newReqId = response.data.request.id;
        setActiveRequestId(newReqId);
        socket.emit('subscribe', { userId: user, requestId: newReqId }); // Tell backend to send updates!
      }
    } catch {
      alert('Failed to send request. Are you sure you are logged in?');
    }
  };

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <header className="app-header">
        <h2>Charge My EV</h2>
        <div className="user-profile">
          <span className="phone-badge">{String(user || '----').slice(-4)}</span>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </header>

      {/* Hero / Map Area */}
      <div className="map-hero">
        <h1>{chargers.length}</h1>
        <p>Chargers near you in San Francisco</p>
      </div>

      {/* Live Host Offers Area */}
      {activeRequestId && (
        <div className="content-section" style={{ background: '#e3f2fd', margin: '20px 24px', borderRadius: '16px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#1565c0' }}>Live Host Offers 📡</h3>
          {hostResponses.length === 0 ? (
            <p style={{ color: '#555', fontSize: '14px', margin: 0 }}>Waiting for nearby hosts to reply...</p>
          ) : (
            hostResponses.map((res) => (
              <div key={res.id} style={{ background: '#fff', padding: '15px', borderRadius: '12px', marginBottom: '10px', border: '1px solid #bbdefb' }}>
                <p style={{ margin: '0 0 5px 0' }}><strong>Host ID:</strong> {String(res.hostId || '----').slice(-4)}</p>
                <p style={{ margin: '0 0 5px 0' }}><strong>Price:</strong> ${res.price}/hr</p>
                <p style={{ margin: '0 0 10px 0' }}><strong>ETA:</strong> {res.estimatedArrival} mins away</p>
                <button className="fab-button" style={{ position: 'relative', left: '0', transform: 'none', width: '100%', justifyContent: 'center', padding: '10px', background: '#00C853' }}>Accept Offer</button>
              </div>
            ))
          )}
        </div>
      )}

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
      {!activeRequestId && (
        <div className="fab-container">
          <button className="fab-button" onClick={handleRequestCharge}>
            ⚡ Request Charge
          </button>
        </div>
      )}
    </div>
  );
}