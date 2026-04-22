import React, { useEffect, useMemo, useState } from 'react';
import { resolveBookingState } from '../../resolveBookingState';

const NOW_STATIC_MS = Date.now();
const ADMIN_TABS = ['overview', 'users', 'sessions', 'disputes', 'payments', 'settings'];
const TAB_LABELS = {
  overview: 'Overview',
  users: 'Users',
  sessions: 'Sessions',
  disputes: 'Disputes',
  payments: 'Payments',
  settings: 'Settings',
};

/**
 * Screen 19 — Admin Dashboard (Web only)
 */
export default function AdminDashboard({
  booking = null,
  myUserId,
  onValidateVisibility,
  onExitFallback,
  overviewStats = {},
  sessionsSeries = [],
  users = [],
  sessions = [],
  disputes = [],
  payments = [],
  settingsRows = [],
  onRowAction,
}) {
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const resolved = resolveBookingState(booking, myUserId);
    onValidateVisibility?.(resolved);
    if (booking && resolved.screen !== 'HOME') {
      onExitFallback?.(resolved);
    }
  }, [booking, myUserId, onValidateVisibility, onExitFallback]);

  const statCards = [
    { label: 'Total Users', value: Number(overviewStats.totalUsers ?? users.length ?? 0).toLocaleString('en-IN') },
    { label: 'Active Sessions', value: Number(overviewStats.activeSessions ?? countByStatus(sessions, ['STARTED', 'CONFIRMED'])).toLocaleString('en-IN') },
    { label: "Today's Revenue", value: `₹${Number(overviewStats.todayRevenue ?? totalTodayRevenue(sessions, payments)).toLocaleString('en-IN')}` },
    { label: 'Open Disputes', value: Number(overviewStats.openDisputes ?? countByStatus(disputes, ['OPEN', 'PENDING'])).toLocaleString('en-IN') },
  ];

  const chartPoints = useMemo(() => normalizeChart(sessionsSeries, sessions), [sessionsSeries, sessions]);

  return (
    <div style={s.page}>
      <style>{cssText}</style>

      <aside style={s.sidebar} className="admin-sidebar">
        <div style={s.brand}>Admin Console</div>
        <nav style={s.navList}>
          {ADMIN_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{ ...s.navBtn, ...(activeTab === tab ? s.navBtnActive : null) }}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </nav>
      </aside>

      <main style={s.main}>
        {activeTab === 'overview' && (
          <OverviewPane
            statCards={statCards}
            chartPoints={chartPoints}
            disputes={disputes.slice(0, 5)}
            sessions={sessions.slice(0, 5)}
            onRowAction={onRowAction}
          />
        )}

        {activeTab === 'users' && (
          <DataPane
            title="Users"
            rows={users}
            columns={[
              col('name', 'Name'),
              col('phone', 'Phone'),
              col('kycStatus', 'KYC'),
              col('createdAt', 'Created', (v) => fmtDate(v)),
            ]}
            sectionKey="users"
            onRowAction={onRowAction}
          />
        )}

        {activeTab === 'sessions' && (
          <DataPane
            title="Sessions"
            rows={sessions}
            columns={[
              col('id', 'Session ID'),
              col('status', 'Status'),
              col('chargingMode', 'Mode'),
              col('finalAmount', 'Amount', (v) => `₹${Number(v || 0).toFixed(0)}`),
              col('startTime', 'Start', (v) => fmtDate(v)),
            ]}
            sectionKey="sessions"
            onRowAction={onRowAction}
          />
        )}

        {activeTab === 'disputes' && (
          <DataPane
            title="Disputes"
            rows={disputes}
            columns={[
              col('id', 'Dispute ID'),
              col('bookingId', 'Booking'),
              col('status', 'Status'),
              col('reason', 'Reason'),
              col('createdAt', 'Created', (v) => fmtDate(v)),
            ]}
            sectionKey="disputes"
            onRowAction={onRowAction}
          />
        )}

        {activeTab === 'payments' && (
          <DataPane
            title="Payments"
            rows={payments}
            columns={[
              col('id', 'Payment ID'),
              col('bookingId', 'Booking'),
              col('status', 'Status'),
              col('amount', 'Amount', (v) => `₹${Number(v || 0).toFixed(0)}`),
              col('updatedAt', 'Updated', (v) => fmtDate(v)),
            ]}
            sectionKey="payments"
            onRowAction={onRowAction}
          />
        )}

        {activeTab === 'settings' && (
          <DataPane
            title="Settings"
            rows={settingsRows}
            columns={[
              col('key', 'Key'),
              col('value', 'Value', (v) => stringifyValue(v)),
              col('updatedAt', 'Updated', (v) => fmtDate(v)),
            ]}
            sectionKey="settings"
            onRowAction={onRowAction}
          />
        )}
      </main>

      <nav style={s.mobileTabs} className="admin-mobile-tabs">
        {ADMIN_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            style={{ ...s.mobileTabBtn, ...(activeTab === tab ? s.mobileTabBtnActive : null) }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </nav>
    </div>
  );
}

function OverviewPane({ statCards, chartPoints, disputes, sessions, onRowAction }) {
  const maxVal = Math.max(1, ...chartPoints.map((p) => p.amount));
  const [activeBar, setActiveBar] = useState(null);

  return (
    <div style={s.sectionWrap}>
      <h1 style={s.pageTitle}>Overview</h1>

      <div style={s.statsGrid}>
        {statCards.map((card) => (
          <div key={card.label} style={s.statCard}>
            <p style={s.statLabel}>{card.label}</p>
            <p style={s.statValue}>{card.value}</p>
          </div>
        ))}
      </div>

      <section style={s.panel}>
        <h2 style={s.panelTitle}>Sessions (Last 7 Days)</h2>
        <div style={s.chartWrap}>
          {chartPoints.map((p, idx) => {
            const heightPct = Math.max(6, (p.amount / maxVal) * 100);
            const active = activeBar === idx;
            return (
              <button
                key={p.key}
                type="button"
                style={s.barSlot}
                onClick={() => setActiveBar(active ? null : idx)}
              >
                {active && <span style={s.tooltip}>₹{Math.round(p.amount).toLocaleString('en-IN')}</span>}
                <span style={{ ...s.bar, height: `${heightPct}%`, opacity: active ? 1 : 0.8 }} />
                <span style={s.barLabel}>{p.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section style={s.panel}>
        <h2 style={s.panelTitle}>Recent Disputes (Last 5)</h2>
        <AdminTable
          rows={disputes}
          columns={[
            col('id', 'Dispute ID'),
            col('bookingId', 'Booking'),
            col('status', 'Status'),
            col('reason', 'Reason'),
            col('createdAt', 'Created', (v) => fmtDate(v)),
          ]}
          sectionKey="overview-disputes"
          onRowAction={onRowAction}
          initialPageSize={20}
        />
      </section>

      <section style={s.panel}>
        <h2 style={s.panelTitle}>Recent Sessions (Last 5)</h2>
        <AdminTable
          rows={sessions}
          columns={[
            col('id', 'Session ID'),
            col('status', 'Status'),
            col('chargingMode', 'Mode'),
            col('finalAmount', 'Amount', (v) => `₹${Number(v || 0).toFixed(0)}`),
            col('startTime', 'Start', (v) => fmtDate(v)),
          ]}
          sectionKey="overview-sessions"
          onRowAction={onRowAction}
          initialPageSize={20}
        />
      </section>
    </div>
  );
}

function DataPane({ title, rows, columns, sectionKey, onRowAction }) {
  return (
    <div style={s.sectionWrap}>
      <h1 style={s.pageTitle}>{title}</h1>
      <section style={s.panel}>
        <AdminTable rows={rows} columns={columns} sectionKey={sectionKey} onRowAction={onRowAction} initialPageSize={20} />
      </section>
    </div>
  );
}

function AdminTable({ rows = [], columns = [], sectionKey, onRowAction, initialPageSize = 20 }) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState(columns[0]?.key || 'id');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((c) => String(row?.[c.key] ?? '').toLowerCase().includes(q))
    );
  }, [rows, columns, query]);

  const sorted = useMemo(() => {
    const next = [...filtered];
    next.sort((a, b) => {
      const av = a?.[sortKey];
      const bv = b?.[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return next;
  }, [filtered, sortKey, sortDir]);

  const pageSize = initialPageSize;
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  return (
    <div>
      <div style={s.tableToolbar}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          style={s.searchInput}
        />
      </div>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={s.th}>
                  <button type="button" onClick={() => toggleSort(c.key)} style={s.sortBtn}>
                    <span>{c.label}</span>
                    <span style={s.sortHint}>{sortKey === c.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                  </button>
                </th>
              ))}
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} style={s.emptyCell}>No records found.</td>
              </tr>
            )}
            {paginated.map((row, idx) => (
              <tr key={row.id || `${sectionKey}-${idx}`} className="admin-row-hover" style={s.tr}>
                {columns.map((c) => (
                  <td key={c.key} style={s.td}>{c.render ? c.render(row?.[c.key], row) : stringifyValue(row?.[c.key])}</td>
                ))}
                <td style={s.td}>
                  <div style={s.actionRow}>
                    <button type="button" style={s.iconBtn} title="View" onClick={() => onRowAction?.('view', row, sectionKey)}>👁</button>
                    <button type="button" style={s.iconBtn} title="Edit" onClick={() => onRowAction?.('edit', row, sectionKey)}>✎</button>
                    <button type="button" style={s.iconBtn} title="More" onClick={() => onRowAction?.('more', row, sectionKey)}>⋯</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={s.paginationRow}>
        <span style={s.pageInfo}>Page {safePage} / {totalPages}</span>
        <div style={s.pageBtns}>
          <button type="button" style={s.pageBtn} disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
          <button type="button" style={s.pageBtn} disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
        </div>
      </div>
    </div>
  );
}

function col(key, label, render) {
  return { key, label, render };
}

function stringifyValue(value) {
  if (value == null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function fmtDate(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parseDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function countByStatus(rows, statuses) {
  const set = new Set(statuses.map((s) => String(s).toUpperCase()));
  return rows.filter((r) => set.has(String(r.status || '').toUpperCase())).length;
}

function totalTodayRevenue(sessions, payments) {
  const start = new Date(NOW_STATIC_MS);
  start.setHours(0, 0, 0, 0);
  const startMs = start.getTime();

  const fromSessions = sessions.reduce((sum, r) => {
    const t = parseDate(r.endTime || r.completedAt || r.updatedAt || r.createdAt)?.getTime();
    if (!Number.isFinite(t) || t < startMs) return sum;
    return sum + Number(r.finalAmount || 0);
  }, 0);

  const fromPayments = payments.reduce((sum, r) => {
    const t = parseDate(r.updatedAt || r.createdAt)?.getTime();
    if (!Number.isFinite(t) || t < startMs) return sum;
    return sum + Number(r.amount || 0);
  }, 0);

  return Math.max(fromSessions, fromPayments);
}

function normalizeChart(series, sessions) {
  if (Array.isArray(series) && series.length > 0) {
    return series.slice(0, 7).map((p, i) => ({
      key: `s${i}`,
      label: p.label || `D${i + 1}`,
      amount: Number(p.amount || 0),
    }));
  }

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const bins = labels.map((label, idx) => ({ key: `d${idx}`, label, amount: 0 }));

  sessions.forEach((row) => {
    const d = parseDate(row.endTime || row.completedAt || row.updatedAt || row.createdAt);
    if (!d) return;
    const day = (d.getDay() + 6) % 7;
    bins[day].amount += Number(row.finalAmount || 0);
  });

  return bins;
}

const cssText = `
  * { box-sizing: border-box; }
  .admin-row-hover:hover { background: rgba(255,255,255,0.045); }
  @media (max-width: 980px) {
    .admin-sidebar { display: none !important; }
    .admin-mobile-tabs { display: grid !important; }
  }
`;

const s = {
  page: {
    minHeight: '100dvh',
    background: '#07090D',
    color: '#E8EEF8',
    display: 'grid',
    gridTemplateColumns: '220px 1fr',
    fontFamily: "'Inter', sans-serif",
  },
  sidebar: {
    borderRight: '1px solid rgba(255,255,255,0.08)',
    padding: '18px 12px',
    background: 'linear-gradient(180deg,#0A1018,#06090F)',
    position: 'sticky',
    top: 0,
    height: '100dvh',
  },
  brand: {
    fontSize: 18,
    fontWeight: 800,
    color: '#00D4AA',
    padding: '0 8px 14px',
  },
  navList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  navBtn: {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.02)',
    color: 'rgba(232,238,248,0.8)',
    borderRadius: 10,
    minHeight: 38,
    textAlign: 'left',
    padding: '0 12px',
    fontSize: 13,
    fontWeight: 600,
  },
  navBtnActive: {
    border: '1px solid rgba(0,212,170,0.42)',
    background: 'rgba(0,212,170,0.15)',
    color: '#00D4AA',
  },
  main: {
    padding: '18px 18px 78px',
  },
  sectionWrap: {
    maxWidth: 1160,
    margin: '0 auto',
    display: 'grid',
    gap: 12,
  },
  pageTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 800,
    color: '#FFFFFF',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
    gap: 10,
  },
  statCard: {
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.025)',
    padding: 12,
  },
  statLabel: {
    margin: 0,
    fontSize: 12,
    color: 'rgba(232,238,248,0.62)',
  },
  statValue: {
    margin: '8px 0 0',
    fontSize: 24,
    fontWeight: 800,
    color: '#00D4AA',
  },
  panel: {
    borderRadius: 14,
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255,255,255,0.02)',
    padding: 12,
  },
  panelTitle: {
    margin: '0 0 10px',
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: 700,
  },
  chartWrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7,minmax(0,1fr))',
    gap: 8,
    alignItems: 'end',
    minHeight: 180,
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: '10px 10px 8px',
    background: 'rgba(0,0,0,0.16)',
  },
  barSlot: {
    position: 'relative',
    border: 'none',
    background: 'transparent',
    padding: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 6,
  },
  tooltip: {
    position: 'absolute',
    top: -24,
    borderRadius: 6,
    background: '#00D4AA',
    color: '#032E25',
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 7px',
  },
  bar: {
    width: '100%',
    borderRadius: '6px 6px 0 0',
    background: '#00D4AA',
  },
  barLabel: {
    fontSize: 10,
    color: 'rgba(232,238,248,0.55)',
  },
  tableToolbar: {
    marginBottom: 10,
  },
  searchInput: {
    width: '100%',
    maxWidth: 300,
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.14)',
    background: 'rgba(255,255,255,0.04)',
    color: '#E8EEF8',
    fontSize: 13,
    padding: '9px 11px',
    outline: 'none',
  },
  tableWrap: {
    overflowX: 'auto',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 700,
  },
  th: {
    textAlign: 'left',
    borderBottom: '1px solid rgba(255,255,255,0.10)',
    padding: '10px 10px',
    fontSize: 12,
    color: 'rgba(232,238,248,0.72)',
    fontWeight: 700,
  },
  sortBtn: {
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
    fontWeight: 700,
    padding: 0,
  },
  sortHint: {
    color: 'rgba(232,238,248,0.5)',
    fontSize: 11,
  },
  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  td: {
    padding: '9px 10px',
    fontSize: 12,
    color: '#D6DEEA',
    whiteSpace: 'nowrap',
  },
  emptyCell: {
    padding: 16,
    textAlign: 'center',
    color: 'rgba(232,238,248,0.55)',
    fontSize: 13,
  },
  actionRow: {
    display: 'inline-flex',
    gap: 6,
  },
  iconBtn: {
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: 7,
    background: 'rgba(255,255,255,0.04)',
    color: '#E8EEF8',
    minWidth: 28,
    minHeight: 28,
    lineHeight: 1,
    fontSize: 12,
  },
  paginationRow: {
    marginTop: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageInfo: {
    color: 'rgba(232,238,248,0.6)',
    fontSize: 12,
  },
  pageBtns: {
    display: 'inline-flex',
    gap: 8,
  },
  pageBtn: {
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.05)',
    color: '#E8EEF8',
    minHeight: 30,
    padding: '0 10px',
    fontSize: 12,
  },
  mobileTabs: {
    display: 'none',
    position: 'fixed',
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(8,10,15,0.95)',
    backdropFilter: 'blur(8px)',
    gridTemplateColumns: 'repeat(6,minmax(0,1fr))',
    gap: 4,
    padding: 6,
  },
  mobileTabBtn: {
    border: 'none',
    background: 'transparent',
    color: 'rgba(232,238,248,0.55)',
    borderRadius: 8,
    minHeight: 34,
    fontSize: 11,
    fontWeight: 600,
    padding: '0 4px',
  },
  mobileTabBtnActive: {
    background: 'rgba(0,212,170,0.2)',
    color: '#00D4AA',
  },
};
