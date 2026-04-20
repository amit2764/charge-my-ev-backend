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
    <div className="space-y-4 p-4 pb-28">
      <div className="glass-surface overflow-hidden rounded-[28px] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Your activity</p>
        <h2 className="mt-1 text-2xl font-black text-white">Session History</h2>
        <p className="mt-1 text-sm text-slate-400">Track completed sessions, payment outcomes, and charging modes.</p>
      </div>
      
      {loading ? (
        <div className="glass-surface skeleton-shimmer py-10 text-center text-gray-500">Loading your past sessions...</div>
      ) : error ? (
        <div className="glass-surface rounded-[18px] border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-300">{error}</div>
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
                  <p className="premium-number text-lg font-black text-cyan-300">₹{amount.toFixed(2)}</p>
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