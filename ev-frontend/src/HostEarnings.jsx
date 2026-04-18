import React, { useState, useEffect } from 'react';
import { Card } from './components';
import api from './api';
import { useStore } from './store';

export default function HostEarnings() {
  const { user } = useStore();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const res = await api.get(`/api/hosts/${encodeURIComponent(user)}/earnings`);
        if (res.data.success && res.data.sessions) {
          setSessions(res.data.sessions);
        }
        setLoading(false);
      } catch (err) {
        setError('Failed to load earning history.');
        setLoading(false);
      }
    };
    fetchEarnings();
  }, [user]);

  const totalEarnings = sessions.reduce((sum, s) => sum + s.amount, 0).toFixed(2);

  return (
    <div className="p-4 pb-28 space-y-6">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-2xl border border-gray-700 text-center shadow-lg">
        <p className="text-gray-400 font-semibold mb-1">Total Earnings</p>
        <h2 className="text-5xl font-black text-cyan-400">${totalEarnings}</h2>
      </div>

      <h3 className="font-bold text-white text-lg">Completed Sessions</h3>
      {loading ? <p className="text-gray-500 text-center py-4">Loading your earnings...</p> : error ? (
        <div className="p-3 text-sm text-red-400 bg-red-900/50 border border-red-800 rounded-lg">{error}</div>
      ) : sessions.length === 0 ? (
        <Card className="text-center py-10"><p className="text-gray-400">No charging sessions completed yet.</p></Card>
      ) : (
        sessions.map(session => (
          <Card key={session.id} className="mb-3">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-white">{session.user}</span>
              <span className="font-bold text-green-400">+${session.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-400"><span>{session.date}</span><span>{session.duration}</span></div>
          </Card>
        ))
      )}
    </div>
  );
}