function formatDate(dateIso) {
  const dt = new Date(dateIso || Date.now());
  if (!Number.isFinite(dt.getTime())) return '-';
  return dt.toLocaleString();
}

function renderRating(value) {
  if (value === null || value === undefined) return 'Skipped';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${n}/5`;
}

export default function SessionHistoryRow({ item, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(17,24,39,0.72))] px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-blue-400/35"
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-white">{item.otherPartyName || 'Unknown'}</p>
        <p className="text-xs text-gray-400">{formatDate(item.date)}</p>
      </div>

      <div className="grid grid-cols-2 gap-y-1 text-xs text-gray-400 sm:grid-cols-4">
        <p>kWh: <span className="text-gray-200">{Number(item.kwh || 0).toFixed(2)}</span></p>
        <p>Duration: <span className="text-gray-200">{item.duration || 0}m</span></p>
        <p>Amount: <span className="premium-number text-emerald-300">${Number(item.finalAmount || 0).toFixed(2)}</span></p>
        <p>My Rating: <span className="text-yellow-400">{renderRating(item.myRating)}</span></p>
      </div>
    </button>
  );
}
