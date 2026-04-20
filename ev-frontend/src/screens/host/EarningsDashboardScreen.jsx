import { useEffect, useState } from 'react';
import api from '../../api';
import { useStore } from '../../store';
import { Card } from '../../components';
import EarningsSummaryCard from '../../components/host/EarningsSummaryCard';
import EarningsSessionRow from '../../components/host/EarningsSessionRow';

function toFixedSafe(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return (0).toFixed(digits);
  return n.toFixed(digits);
}

export default function EarningsDashboardScreen() {
  const { user } = useStore();
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    total: 0,
    periodTotal: 0,
    sessionCount: 0,
    avgKwh: 0,
    avgDuration: 0,
    bestCharger: null,
    recentSessions: []
  });

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const fetchEarnings = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/api/host/earnings', {
          params: {
            hostId: user,
            period
          }
        });
        if (cancelled) return;
        if (res.data?.success) {
          setData({
            total: Number(res.data.total || 0),
            periodTotal: Number(res.data.periodTotal || 0),
            sessionCount: Number(res.data.sessionCount || 0),
            avgKwh: Number(res.data.avgKwh || 0),
            avgDuration: Number(res.data.avgDuration || 0),
            bestCharger: res.data.bestCharger || null,
            recentSessions: Array.isArray(res.data.recentSessions) ? res.data.recentSessions : []
          });
        } else {
          setError('Failed to load earnings dashboard.');
        }
      } catch (err) {
        if (cancelled) return;
        setError(err.response?.data?.error || 'Failed to load earnings dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchEarnings();
    return () => {
      cancelled = true;
    };
  }, [user, period]);

  return (
    <div className="space-y-4 p-0">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Performance</p>
          <h2 className="text-xl font-black text-white">Earnings Dashboard</h2>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-[16px] border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {loading ? (
        <Card className="py-10 text-center text-gray-500">Loading earnings...</Card>
      ) : error ? (
        <Card className="border-red-800 bg-red-900/20 py-5 text-center text-red-400">{error}</Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <EarningsSummaryCard title="Total Earned (All Time)" value={data.total} />
            <EarningsSummaryCard title={period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'Selected Period'} value={data.periodTotal} />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Card>
              <p className="text-xs uppercase tracking-wider text-gray-400">Completed Sessions</p>
              <p className="premium-number mt-1 text-3xl font-black text-white">{data.sessionCount}</p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wider text-gray-400">Avg Session Duration</p>
              <p className="premium-number mt-1 text-3xl font-black text-white">{toFixedSafe(data.avgDuration, 1)}<span className="ml-1 text-lg text-slate-500">m</span></p>
            </Card>
            <Card>
              <p className="text-xs uppercase tracking-wider text-gray-400">Avg kWh Delivered</p>
              <p className="premium-number mt-1 text-3xl font-black text-cyan-300">{toFixedSafe(data.avgKwh, 2)}</p>
            </Card>
          </div>

          <Card>
            <p className="text-xs uppercase tracking-wider text-gray-400">Best Performing Charger</p>
            {data.bestCharger ? (
              <>
                <p className="mt-1 text-lg font-bold text-cyan-300">{data.bestCharger.chargerName || 'Default Charger'}</p>
                <p className="text-sm text-gray-400">Sessions: {Number(data.bestCharger.sessions || 0)}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-gray-500">No completed sessions yet.</p>
            )}
          </Card>

          <div className="space-y-2">
            <p className="text-sm font-bold text-white">Recent Completed Sessions</p>
            {data.recentSessions.length === 0 ? (
              <Card className="py-8 text-center text-gray-500">No recent completed sessions.</Card>
            ) : (
              data.recentSessions.map((session) => (
                <EarningsSessionRow key={session.id} session={session} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
