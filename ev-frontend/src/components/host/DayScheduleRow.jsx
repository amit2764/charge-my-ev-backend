export default function DayScheduleRow({ label, value, onChange }) {
  const update = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-[70px_1fr_1fr_1fr] items-center gap-2 rounded-md border border-gray-800 bg-black/40 p-2">
      <p className="text-xs font-semibold text-gray-300">{label}</p>
      <label className="flex items-center gap-1 text-xs text-gray-400">
        <input
          type="checkbox"
          checked={!!value.available}
          onChange={(e) => update({ available: e.target.checked })}
        />
        Available
      </label>
      <input
        type="time"
        value={value.start}
        disabled={!value.available}
        onChange={(e) => update({ start: e.target.value })}
        className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white disabled:opacity-40"
      />
      <input
        type="time"
        value={value.end}
        disabled={!value.available}
        onChange={(e) => update({ end: e.target.value })}
        className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-xs text-white disabled:opacity-40"
      />
    </div>
  );
}
