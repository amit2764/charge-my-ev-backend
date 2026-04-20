import EarningsDashboardScreen from './screens/host/EarningsDashboardScreen';

export default function HostEarnings() {
  return (
    <div className="space-y-4 p-4 pb-28 sm:p-5">
      <div className="glass-surface overflow-hidden rounded-[28px] p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Financials</p>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white">Wallet & earnings</h1>
        <p className="mt-1 text-sm text-slate-400">A premium summary of payouts, session revenue, performance, and recent activity.</p>
      </div>
      <EarningsDashboardScreen />
    </div>
  );
}