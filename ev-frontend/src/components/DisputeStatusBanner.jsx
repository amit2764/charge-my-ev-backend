function statusText(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'RAISED') return 'Dispute raised and awaiting review.';
  if (normalized === 'UNDER_REVIEW') return 'Dispute is under review.';
  if (normalized === 'RESOLVED') return 'Dispute resolved.';
  return '';
}

function statusClass(status) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'RAISED') return 'border-amber-600 bg-amber-950/30 text-amber-200';
  if (normalized === 'UNDER_REVIEW') return 'border-blue-600 bg-blue-950/30 text-blue-200';
  if (normalized === 'RESOLVED') return 'border-emerald-600 bg-emerald-950/30 text-emerald-200';
  return 'border-gray-700 bg-gray-900 text-gray-200';
}

export default function DisputeStatusBanner({ dispute }) {
  if (!dispute) return null;

  const status = String(dispute.status || '').toUpperCase();
  if (status !== 'RAISED' && status !== 'UNDER_REVIEW') return null;

  return (
    <div className={`rounded-[16px] border px-3 py-2 text-sm shadow-[0_10px_24px_rgba(2,6,23,0.2)] ${statusClass(status)}`}>
      <p className="font-semibold">Dispute Status: {status.replace('_', ' ')}</p>
      <p className="text-xs opacity-90">{statusText(status)}</p>
    </div>
  );
}
