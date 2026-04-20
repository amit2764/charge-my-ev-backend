import { Card } from '../../components';

function formatINR(value) {
  const amount = Number(value) || 0;
  const isWhole = Math.abs(amount % 1) < 0.000001;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(dateIso) {
  const ms = new Date(dateIso || 0).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return '-';
  return new Date(ms).toLocaleString('en-IN');
}

export default function EarningsSessionRow({ session }) {
  return (
    <Card className="border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(17,24,39,0.7))] p-4">
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-white">{session.userName || 'Unknown user'}</p>
        <p className="premium-number text-sm font-black text-emerald-300">{formatINR(session.amount)}</p>
      </div>
      <div className="grid grid-cols-2 gap-y-1 text-xs text-gray-400 sm:grid-cols-4">
        <p>Date: <span className="text-gray-200">{formatDate(session.date)}</span></p>
        <p>kWh: <span className="text-gray-200">{Number(session.kwh || 0).toFixed(2)}</span></p>
        <p>Duration: <span className="text-gray-200">{Math.round(Number(session.duration || 0))}m</span></p>
        <p>Charger: <span className="text-gray-200">{session.chargerName || 'Default Charger'}</span></p>
      </div>
    </Card>
  );
}
