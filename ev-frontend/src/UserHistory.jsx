import React, { useState, useEffect } from 'react';
import { useStore } from './store';
import { Card, Button } from './components';
import api from './api';

export default function UserHistory() {
  const { user } = useStore();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        // Fetch real history from backend
        const res = await api.get(`/api/bookings/history/${encodeURIComponent(user)}`);
        if (res.data.success && res.data.bookings) {
          setSessions(res.data.bookings);
        }
        setLoading(false);
      } catch {
        setError('Failed to load session history.');
        setLoading(false);
      }
    };
    fetchHistory();
  }, [user]);

  return (
    <div className="p-4 pb-28 space-y-4">
      <h2 className="text-2xl font-bold text-white mb-6">Session History</h2>
      
      {loading ? (
        <p className="text-center text-gray-500 py-10">Loading your past sessions...</p>
      ) : error ? (
        <div className="p-3 text-sm text-red-400 bg-red-900/50 border border-red-800 rounded-lg">{error}</div>
      ) : sessions.length === 0 ? (
        <Card className="text-center py-10"><p className="text-gray-400">No past charging sessions found.</p></Card>
      ) : (
        sessions.map(booking => {
          const date = booking.createdAt
            ? new Date(booking.createdAt._seconds ? booking.createdAt._seconds * 1000 : booking.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—';
          const hostDisplay = booking.hostId ? `…${booking.hostId.slice(-4)}` : '—';
          const amount = typeof booking.finalAmount === 'number' ? booking.finalAmount : (booking.price ?? 0);
          const duration = booking.durationMinutes ? `${booking.durationMinutes} min` : '—';
          const modeLabel = { eco: '🌿 Eco', normal: '⚡ Normal', boost: '🚀 Boost' }[booking.chargingMode] || '';
          const statusColor = booking.status === 'COMPLETED' ? 'text-green-400' : 'text-yellow-400';

          return (
            <Card key={booking.id} className="mb-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-bold text-white text-lg">Host {hostDisplay}</p>
                  <p className="text-sm text-gray-400">{date}</p>
                  {modeLabel && <p className="text-xs text-gray-500 mt-1">{modeLabel}</p>}
                  {booking.emergencyStopped && <p className="text-xs text-red-400 mt-1">⛔ Emergency stop</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-cyan-400 text-lg">₹{amount.toFixed(2)}</p>
                  <p className="text-sm text-gray-400">{duration}</p>
                  <p className={`text-xs font-semibold mt-1 ${statusColor}`}>{booking.status}</p>
                  {booking.paymentStatus && <p className="text-xs text-gray-500">{booking.paymentStatus}</p>}
                </div>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}