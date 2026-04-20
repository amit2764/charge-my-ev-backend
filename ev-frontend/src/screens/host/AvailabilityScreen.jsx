import { useMemo, useState } from 'react';
import DayScheduleRow from '../../components/host/DayScheduleRow';
import { normalizeSchedule } from '../../utils/scheduleUtils';

const DAY_ORDER = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun']
];

const DEFAULT_DAY = { available: false, start: '09:00', end: '21:00' };

export default function AvailabilityScreen({ charger, onCancel, onSave }) {
  const initial = useMemo(() => normalizeSchedule(charger?.schedule || {}), [charger?.schedule]);
  const [schedule, setSchedule] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setDay = (key, next) => {
    setSchedule((prev) => ({ ...prev, [key]: next }));
  };

  const copyToAll = (fromKey) => {
    const base = schedule[fromKey] || DEFAULT_DAY;
    const next = {};
    DAY_ORDER.forEach(([k]) => {
      next[k] = { ...base };
    });
    setSchedule(next);
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(schedule);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to save schedule.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white">Charger Availability</h3>
        <button
          onClick={() => copyToAll('mon')}
          className="rounded-md border border-gray-700 px-2 py-1 text-xs text-cyan-300 hover:bg-gray-800"
        >
          Copy Monday to all
        </button>
      </div>

      {error && <p className="rounded-md border border-red-800 bg-red-950/40 p-2 text-xs text-red-300">{error}</p>}

      <div className="space-y-2">
        {DAY_ORDER.map(([key, label]) => (
          <DayScheduleRow
            key={key}
            label={label}
            value={schedule[key] || DEFAULT_DAY}
            onChange={(next) => setDay(key, next)}
          />
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 rounded-md border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:bg-gray-800">Cancel</button>
        <button onClick={submit} disabled={saving} className="flex-1 rounded-md bg-cyan-500 px-3 py-2 text-xs font-semibold text-black hover:bg-cyan-400 disabled:opacity-60">{saving ? 'Saving...' : 'Save schedule'}</button>
      </div>
    </div>
  );
}
