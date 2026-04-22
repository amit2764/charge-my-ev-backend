import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import useSessionHistory from '../../hooks/useSessionHistory';
import SessionHistoryRow from '../../components/SessionHistoryRow';
import { resolveBookingState } from '../../resolveBookingState';
import { useI18n } from '../../i18n';

export default function EarningsDashboardScreen({
  booking = null,
  myUserId,
  onValidateVisibility,
  onExitFallback,
}) {
  const { t, locale } = useI18n();
  const isHindi = locale === 'hi';
  const { user } = useStore();
  const userId = myUserId || user;

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  const [period, setPeriod] = useState('month');
  const [activeBar, setActiveBar] = useState(null);

  const {
    items,
    rawItems,
    loading,
    refreshing,
    error,
    setRange,
    refresh,
  } = useSessionHistory({ userId, role: 'host', pageSize: 20 });

  useEffect(() => {
    const resolved = resolveBookingState(booking, userId);
    onValidateVisibility?.(resolved);
    if (booking && resolved.screen !== 'HOME') {
      onExitFallback?.(resolved);
    }
  }, [booking, userId, onValidateVisibility, onExitFallback]);

  useEffect(() => {
    if (period === 'week') setRange('7');
    if (period === 'month') setRange('30');
    if (period === 'all') setRange('all');
  }, [period, setRange]);

  const parsedItems = useMemo(() => items.map(normalizeItem), [items]);
  const allParsed = useMemo(() => rawItems.map(normalizeItem), [rawItems]);

  const totalEarned = useMemo(
    () => allParsed.reduce((sum, it) => sum + Number(it.finalAmount || 0), 0),
    [allParsed]
  );

  const periodSessions = parsedItems.length;
  const periodKwh = useMemo(
    () => parsedItems.reduce((sum, it) => sum + Number(it.kwh || 0), 0),
    [parsedItems]
  );

  const avgPerSession = periodSessions ? totalAmount(parsedItems) / periodSessions : 0;
  const avgDuration = periodSessions
    ? parsedItems.reduce((sum, it) => sum + Number(it.durationMinutes || 0), 0) / periodSessions
    : 0;

  const chartPoints = useMemo(() => buildChartPoints(parsedItems, period), [parsedItems, period]);
  const maxBar = Math.max(1, ...chartPoints.map((p) => p.amount));

  const bestDay = useMemo(() => {
    if (!chartPoints.length) return { label: '—', amount: 0 };
    return chartPoints.reduce((best, p) => (p.amount > best.amount ? p : best), chartPoints[0]);
  }, [chartPoints]);

  const recentSessions = parsedItems.slice(0, 8);

  return (
    <div className="min-h-[100dvh] bg-[#0A0A0F] px-4 pb-6 pt-5 text-white">
      <div className="mx-auto w-full max-w-[430px] space-y-4">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex gap-2">
            <PeriodChip label={tx('earn.week', isHindi ? 'Week' : 'Week')} active={period === 'week'} onPress={() => setPeriod('week')} />
            <PeriodChip label={tx('earn.month', isHindi ? 'Month' : 'Month')} active={period === 'month'} onPress={() => setPeriod('month')} />
            <PeriodChip label={tx('earn.all', isHindi ? 'All time' : 'All time')} active={period === 'all'} onPress={() => setPeriod('all')} />
          </div>

          <p className="text-[13px] text-white/65">{tx('earn.totalEarned', isHindi ? 'कुल कमाई' : 'Total earned')}</p>
          <h1 className="mt-1 text-[34px] font-extrabold leading-none text-[#00D4AA]">₹{Math.round(totalEarned).toLocaleString('en-IN')}</h1>
          <p className="mt-2 text-sm text-white/65">{periodSessions} {tx('earn.sessions', isHindi ? 'sessions' : 'sessions')} | {periodKwh.toFixed(2)} kWh {tx('earn.delivered', isHindi ? 'delivered' : 'delivered')}</p>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-white">{tx('earn.chart', isHindi ? 'Earnings chart' : 'Earnings chart')}</p>
            <button
              type="button"
              onClick={() => refresh?.()}
              className="rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/80 hover:bg-white/5"
            >
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {chartPoints.length === 0 ? (
            <p className="py-8 text-center text-sm text-white/55">No data for this period.</p>
          ) : (
            <div className="grid grid-cols-[44px_1fr] gap-2">
              <div className="flex h-44 flex-col justify-between pb-5 text-[10px] text-white/45">
                <span>₹{Math.round(maxBar).toLocaleString('en-IN')}</span>
                <span>₹{Math.round(maxBar * 0.5).toLocaleString('en-IN')}</span>
                <span>₹0</span>
              </div>
              <div>
                <div className="relative flex h-44 items-end gap-2 rounded-xl border border-white/10 bg-black/20 px-2 pb-5 pt-2">
                  {chartPoints.map((p, idx) => {
                    const pct = Math.max(5, (p.amount / maxBar) * 100);
                    const active = activeBar === idx;
                    return (
                      <button
                        key={p.key}
                        type="button"
                        className="relative flex-1"
                        onClick={() => setActiveBar(active ? null : idx)}
                        style={{ border: 'none', background: 'transparent', padding: 0 }}
                      >
                        {active && (
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#00D4AA] px-2 py-1 text-[10px] font-bold text-[#032E25]">
                            ₹{Math.round(p.amount).toLocaleString('en-IN')}
                          </span>
                        )}
                        <span
                          className="mx-auto block w-full rounded-t-md bg-[#00D4AA] transition"
                          style={{ height: `${pct}%`, opacity: active ? 1 : 0.78 }}
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2 flex gap-2 px-2">
                  {chartPoints.map((p) => (
                    <span key={p.key} className="flex-1 truncate text-center text-[10px] text-white/55">{p.label}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="grid grid-cols-2 gap-2">
          <BreakdownCard label={tx('earn.avgPerSession', isHindi ? 'Avg per session' : 'Avg per session')} value={`₹${Math.round(avgPerSession).toLocaleString('en-IN')}`} />
          <BreakdownCard label={tx('earn.bestDay', isHindi ? 'Best day' : 'Best day')} value={`${bestDay.label} · ₹${Math.round(bestDay.amount).toLocaleString('en-IN')}`} />
          <BreakdownCard label={tx('earn.totalKwh', isHindi ? 'Total kWh' : 'Total kWh')} value={`${periodKwh.toFixed(2)} kWh`} />
          <BreakdownCard label={tx('earn.avgDuration', isHindi ? 'Avg session duration' : 'Avg session duration')} value={`${avgDuration.toFixed(1)} min`} />
        </section>

        <section>
          <p className="mb-2 text-sm font-bold text-white">{tx('earn.recentSessions', isHindi ? 'Recent sessions' : 'Recent sessions')}</p>
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center text-sm text-white/55">Loading sessions...</div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-900/20 p-4 text-sm text-rose-300">{error}</div>
          ) : recentSessions.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center text-sm text-white/55">No sessions found.</div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((session) => (
                <SessionHistoryRow key={session.id} item={session} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PeriodChip({ label, active, onPress }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${active
        ? 'border-[#00D4AA] bg-[#00D4AA]/20 text-[#00D4AA]'
        : 'border-white/15 bg-white/5 text-white/75 hover:bg-white/10'}`}
    >
      {label}
    </button>
  );
}

function BreakdownCard({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="text-[11px] text-white/60">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

function normalizeItem(item = {}) {
  const finalAmount = Number(item.finalAmount ?? item.amount ?? 0);
  const kwh = Number(item.kwh ?? item.energyKwh ?? item.deliveredKwh ?? 0);
  const durationMinutes = Number(item.duration ?? item.durationMinutes ?? 0);
  const date = parseDate(item.completedAt || item.endTime || item.date || item.updatedAt || item.createdAt);
  return {
    ...item,
    finalAmount,
    kwh,
    durationMinutes,
    date,
  };
}

function parseDate(value) {
  if (!value) return new Date(0);
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return Number.isFinite(d.getTime()) ? d : new Date(0);
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? new Date(ms) : new Date(0);
}

function totalAmount(items) {
  return items.reduce((sum, it) => sum + Number(it.finalAmount || 0), 0);
}

function buildChartPoints(items, period) {
  if (!items.length) return [];

  if (period === 'week') {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const map = labels.map((label, idx) => ({ key: `d${idx}`, label, amount: 0 }));
    items.forEach((it) => {
      const d = it.date;
      const day = (d.getDay() + 6) % 7;
      map[day].amount += Number(it.finalAmount || 0);
    });
    return map;
  }

  if (period === 'month') {
    const bins = [
      { key: 'w1', label: 'W1', amount: 0 },
      { key: 'w2', label: 'W2', amount: 0 },
      { key: 'w3', label: 'W3', amount: 0 },
      { key: 'w4', label: 'W4', amount: 0 },
      { key: 'w5', label: 'W5', amount: 0 },
    ];
    items.forEach((it) => {
      const date = it.date;
      const week = Math.min(4, Math.floor((date.getDate() - 1) / 7));
      bins[week].amount += Number(it.finalAmount || 0);
    });
    return bins;
  }

  const m = new Map();
  items.forEach((it) => {
    const d = it.date;
    const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
    m.set(label, (m.get(label) || 0) + Number(it.finalAmount || 0));
  });
  return Array.from(m.entries()).slice(-6).map(([label, amount], i) => ({ key: `m${i}`, label, amount }));
}
