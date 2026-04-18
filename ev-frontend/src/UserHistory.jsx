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
      } catch (err) {
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
        sessions.map(session => (
          <Card key={session.id} className="mb-4">
            <div className="flex justify-between items-start mb-3">
              <div><p className="font-bold text-white text-lg">{session.host}</p><p className="text-sm text-gray-400">{session.date}</p></div>
              <div className="text-right"><p className="font-bold text-cyan-400 text-lg">${session.amount.toFixed(2)}</p><p className="text-sm text-gray-400">{session.duration}</p></div>
            </div>
            <Button variant="outline" className="py-2 text-sm mt-2">Re-book Host</Button>
          </Card>
        ))
      )}
    </div>
  );
}