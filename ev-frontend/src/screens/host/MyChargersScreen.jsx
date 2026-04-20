import { useCallback, useEffect, useState } from 'react';
import api from '../../api';
import ChargerCard from '../../components/host/ChargerCard';
import AddChargerScreen from './AddChargerScreen';
import EditChargerScreen from './EditChargerScreen';
import AvailabilityScreen from './AvailabilityScreen';

export default function MyChargersScreen({ hostId }) {
  const [chargers, setChargers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('list');
  const [editing, setEditing] = useState(null);
  const [scheduleFor, setScheduleFor] = useState(null);
  const [togglingId, setTogglingId] = useState('');

  const load = useCallback(async () => {
    if (!hostId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/chargers/mine?hostId=${encodeURIComponent(hostId)}`);
      setChargers(Array.isArray(res.data?.chargers) ? res.data.chargers : []);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load chargers.');
    } finally {
      setLoading(false);
    }
  }, [hostId]);

  useEffect(() => {
    load();
  }, [load]);

  const createCharger = async (formData) => {
    formData.append('hostId', hostId);
    await api.post('/api/chargers', formData);
    setMode('list');
    await load();
  };

  const updateCharger = async (formData) => {
    await api.put(`/api/chargers/${editing.id}`, formData);
    setMode('list');
    setEditing(null);
    await load();
  };

  const toggleOnline = async (charger) => {
    setTogglingId(charger.id);
    const previous = chargers;
    const nextOnline = !charger.online;

    setChargers((prev) => prev.map((c) => (c.id === charger.id ? { ...c, online: nextOnline } : c)));

    try {
      await api.patch(`/api/chargers/${charger.id}/toggle`, { hostId, online: nextOnline });
    } catch (e) {
      setChargers(previous);
      setError(e.response?.data?.error || e.message || 'Failed to toggle charger status.');
    } finally {
      setTogglingId('');
    }
  };

  if (mode === 'add') {
    return <AddChargerScreen onCancel={() => setMode('list')} onCreate={createCharger} />;
  }

  if (mode === 'edit' && editing) {
    return (
      <EditChargerScreen
        charger={editing}
        onCancel={() => {
          setMode('list');
          setEditing(null);
        }}
        onUpdate={updateCharger}
      />
    );
  }

  if (mode === 'schedule' && scheduleFor) {
    return (
      <AvailabilityScreen
        charger={scheduleFor}
        onCancel={() => {
          setMode('list');
          setScheduleFor(null);
        }}
        onSave={async (schedule) => {
          await api.put(`/api/chargers/${scheduleFor.id}/schedule`, { hostId, schedule });
          setMode('list');
          setScheduleFor(null);
          await load();
        }}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">My Chargers</h3>
        <button
          onClick={() => setMode('add')}
          className="rounded-md bg-cyan-500 px-3 py-2 text-xs font-semibold text-black hover:bg-cyan-400"
        >
          Add charger
        </button>
      </div>

      {error && <p className="rounded-md border border-red-800 bg-red-950/40 p-2 text-xs text-red-300">{error}</p>}
      {loading && <p className="text-xs text-cyan-300">Loading chargers...</p>}
      {!loading && chargers.length === 0 && <p className="text-sm text-gray-500">No chargers yet. Add your first charger.</p>}

      <div className="space-y-2">
        {chargers.map((charger) => (
          <ChargerCard
            key={charger.id}
            charger={charger}
            toggling={togglingId === charger.id}
            onToggle={() => toggleOnline(charger)}
            onEdit={() => {
              setEditing(charger);
              setMode('edit');
            }}
            onSchedule={() => {
              setScheduleFor(charger);
              setMode('schedule');
            }}
          />
        ))}
      </div>
    </div>
  );
}
