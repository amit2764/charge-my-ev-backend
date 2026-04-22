import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useStore } from '../../store';
import useSessionHistory from '../../hooks/useSessionHistory';
import { resolveBookingState } from '../../resolveBookingState';
import { useI18n } from '../../i18n';

/**
 * Screen 18 — Earnings Dashboard (Host, Native)
 */
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

  const [period, setPeriod] = useState('month');
  const [activeBar, setActiveBar] = useState(null);

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

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

  const totalEarned = useMemo(() => allParsed.reduce((sum, it) => sum + Number(it.finalAmount || 0), 0), [allParsed]);
  const periodSessions = parsedItems.length;
  const periodKwh = useMemo(() => parsedItems.reduce((sum, it) => sum + Number(it.kwh || 0), 0), [parsedItems]);

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
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.headerCard}>
          <View style={s.chipRow}>
            <PeriodChip label={tx('earn.week', isHindi ? 'Week' : 'Week')} active={period === 'week'} onPress={() => setPeriod('week')} />
            <PeriodChip label={tx('earn.month', isHindi ? 'Month' : 'Month')} active={period === 'month'} onPress={() => setPeriod('month')} />
            <PeriodChip label={tx('earn.all', isHindi ? 'All time' : 'All time')} active={period === 'all'} onPress={() => setPeriod('all')} />
          </View>

          <Text style={s.subhead}>{tx('earn.totalEarned', isHindi ? 'कुल कमाई' : 'Total earned')}</Text>
          <Text style={s.total}>₹{Math.round(totalEarned).toLocaleString('en-IN')}</Text>
          <Text style={s.smallMeta}>{periodSessions} {tx('earn.sessions', isHindi ? 'sessions' : 'sessions')} | {periodKwh.toFixed(2)} kWh {tx('earn.delivered', isHindi ? 'delivered' : 'delivered')}</Text>
        </View>

        <View style={s.chartCard}>
          <View style={s.chartHeader}>
            <Text style={s.sectionTitle}>{tx('earn.chart', isHindi ? 'Earnings chart' : 'Earnings chart')}</Text>
            <Pressable style={s.refreshBtn} onPress={() => refresh?.()}>
              <Text style={s.refreshText}>{refreshing ? 'Refreshing...' : 'Refresh'}</Text>
            </Pressable>
          </View>

          {chartPoints.length === 0 ? (
            <Text style={s.emptyText}>No data for this period.</Text>
          ) : (
            <View style={s.chartWrap}>
              <View style={s.yAxis}>
                <Text style={s.axisText}>₹{Math.round(maxBar).toLocaleString('en-IN')}</Text>
                <Text style={s.axisText}>₹{Math.round(maxBar * 0.5).toLocaleString('en-IN')}</Text>
                <Text style={s.axisText}>₹0</Text>
              </View>

              <View style={s.barsZone}>
                <View style={s.barsInner}>
                  {chartPoints.map((p, idx) => {
                    const pct = Math.max(5, (p.amount / maxBar) * 100);
                    const active = activeBar === idx;
                    return (
                      <Pressable key={p.key} style={s.barSlot} onPress={() => setActiveBar(active ? null : idx)}>
                        {active && (
                          <View style={s.tooltip}>
                            <Text style={s.tooltipText}>₹{Math.round(p.amount).toLocaleString('en-IN')}</Text>
                          </View>
                        )}
                        <View style={[s.bar, { height: `${pct}%`, opacity: active ? 1 : 0.78 }]} />
                      </Pressable>
                    );
                  })}
                </View>
                <View style={s.xLabels}>
                  {chartPoints.map((p) => (
                    <Text key={p.key} style={s.xLabel}>{p.label}</Text>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={s.breakGrid}>
          <BreakdownCard label={tx('earn.avgPerSession', isHindi ? 'Avg per session' : 'Avg per session')} value={`₹${Math.round(avgPerSession).toLocaleString('en-IN')}`} />
          <BreakdownCard label={tx('earn.bestDay', isHindi ? 'Best day' : 'Best day')} value={`${bestDay.label} · ₹${Math.round(bestDay.amount).toLocaleString('en-IN')}`} />
          <BreakdownCard label={tx('earn.totalKwh', isHindi ? 'Total kWh' : 'Total kWh')} value={`${periodKwh.toFixed(2)} kWh`} />
          <BreakdownCard label={tx('earn.avgDuration', isHindi ? 'Avg session duration' : 'Avg session duration')} value={`${avgDuration.toFixed(1)} min`} />
        </View>

        <View>
          <Text style={s.sectionTitle}>{tx('earn.recentSessions', isHindi ? 'Recent sessions' : 'Recent sessions')}</Text>
          {loading ? (
            <View style={s.feedbackCard}><Text style={s.feedbackText}>Loading sessions...</Text></View>
          ) : error ? (
            <View style={[s.feedbackCard, s.errorCard]}><Text style={s.errorText}>{error}</Text></View>
          ) : recentSessions.length === 0 ? (
            <View style={s.feedbackCard}><Text style={s.feedbackText}>No sessions found.</Text></View>
          ) : (
            <View style={s.listWrap}>
              {recentSessions.map((session) => (
                <SessionHistoryRowNative key={session.id} item={session} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function PeriodChip({ label, active, onPress }) {
  return (
    <Pressable style={[s.chip, active && s.chipActive]} onPress={onPress}>
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function BreakdownCard({ label, value }) {
  return (
    <View style={s.breakCard}>
      <Text style={s.breakLabel}>{label}</Text>
      <Text style={s.breakValue}>{value}</Text>
    </View>
  );
}

function SessionHistoryRowNative({ item }) {
  return (
    <View style={s.row}>
      <View style={s.rowTop}>
        <Text style={s.rowName}>{item.otherPartyName || 'Unknown'}</Text>
        <Text style={s.rowDate}>{formatDate(item.date)}</Text>
      </View>
      <View style={s.rowMeta}>
        <Text style={s.rowMetaText}>kWh: <Text style={s.rowMetaValue}>{Number(item.kwh || 0).toFixed(2)}</Text></Text>
        <Text style={s.rowMetaText}>Duration: <Text style={s.rowMetaValue}>{Number(item.durationMinutes || 0)}m</Text></Text>
        <Text style={s.rowMetaText}>Amount: <Text style={s.rowAmount}>₹{Number(item.finalAmount || 0).toFixed(0)}</Text></Text>
      </View>
    </View>
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

function formatDate(value) {
  const d = parseDate(value);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-';
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
      const week = Math.min(4, Math.floor((it.date.getDate() - 1) / 7));
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

const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 26,
    gap: 12,
  },
  headerCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 14,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  chipActive: {
    borderColor: '#00D4AA',
    backgroundColor: 'rgba(0,212,170,0.2)',
  },
  chipText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#00D4AA',
  },
  subhead: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
  },
  total: {
    color: '#00D4AA',
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    marginTop: 2,
  },
  smallMeta: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    marginTop: 6,
  },

  chartCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 14,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  refreshBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  refreshText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
    paddingVertical: 20,
    fontSize: 13,
  },
  chartWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  yAxis: {
    height: 176,
    justifyContent: 'space-between',
    paddingBottom: 18,
    width: 46,
  },
  axisText: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
  },
  barsZone: {
    flex: 1,
  },
  barsInner: {
    height: 176,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  barSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    backgroundColor: '#00D4AA',
  },
  tooltip: {
    position: 'absolute',
    top: -30,
    borderRadius: 6,
    backgroundColor: '#00D4AA',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tooltipText: {
    color: '#032E25',
    fontSize: 10,
    fontWeight: '700',
  },
  xLabels: {
    marginTop: 6,
    paddingHorizontal: 8,
    flexDirection: 'row',
    gap: 8,
  },
  xLabel: {
    flex: 1,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
  },

  breakGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  breakCard: {
    width: '48.8%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
  },
  breakLabel: {
    color: 'rgba(255,255,255,0.60)',
    fontSize: 11,
  },
  breakValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },

  feedbackCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 16,
    alignItems: 'center',
  },
  feedbackText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
  },
  errorCard: {
    borderColor: 'rgba(244,63,94,0.3)',
    backgroundColor: 'rgba(127,29,29,0.2)',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
  },

  listWrap: {
    gap: 8,
  },
  row: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  rowDate: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
  },
  rowMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  rowMetaText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
  },
  rowMetaValue: {
    color: '#E5E7EB',
  },
  rowAmount: {
    color: '#6EE7B7',
    fontWeight: '700',
  },
});
