export default function VerifiedBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full border border-emerald-500/60 bg-emerald-900/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ${className}`}>
      Verified
    </span>
  );
}
