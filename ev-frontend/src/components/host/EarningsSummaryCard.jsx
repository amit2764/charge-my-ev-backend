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

export default function EarningsSummaryCard({ title, value, subtitle }) {
  return (
    <Card className="border border-white/10 bg-[linear-gradient(145deg,rgba(30,41,59,0.72),rgba(15,23,42,0.9))]">
      <p className="text-xs uppercase tracking-wider text-gray-400">{title}</p>
      <p className="premium-number mt-1 text-3xl font-black text-cyan-300">{formatINR(value)}</p>
      {subtitle ? <p className="mt-1 text-xs text-gray-500">{subtitle}</p> : null}
    </Card>
  );
}
