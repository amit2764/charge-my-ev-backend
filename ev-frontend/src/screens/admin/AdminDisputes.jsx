import React, { useMemo, useState } from 'react';

/**
 * AdminDisputes — Screen 19 sub-page (web only)
 *
 * Standalone admin page for reviewing and resolving disputes.
 *
 * Props:
 *  disputes []    — array of dispute objects
 *  onRowAction(action, row)  — 'view' | 'resolve' | 'escalate' | 'reject'
 *  onBack()       — optional back button
 */
export default function AdminDisputes({
  disputes = [],
  onRowAction,
  onBack,
}) {
  const openCount = useMemo(
    () => disputes.filter((d) => ['OPEN', 'PENDING'].includes(String(d.status || '').toUpperCase())).length,
    [disputes]
  );

  const columns = [
    col('id', 'Dispute ID', (v) => truncate(v)),
    col('bookingId', 'Booking', (v) => truncate(v)),
    col('status', 'Status', (v) => statusBadge(v)),
    col('reason', 'Reason'),
    col('raisedBy', 'Raised By'),
    col('amount', 'Amount', (v) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—'),
    col('createdAt', 'Created', fmtDate),
    col('resolvedAt', 'Resolved', fmtDate),
  ];

  return (
    <div style={s.page}>
      <style>{cssText}</style>

      <div style={s.header}>
        {onBack && (
          <button type="button" style={s.backBtn} onClick={onBack}>
            ← Back
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h1 style={s.title}>Disputes</h1>
          {openCount > 0 && (
            <span style={s.alertBadge}>{openCount} open</span>
          )}
        </div>
        <p style={s.subtitle}>{disputes.length.toLocaleString('en-IN')} total disputes</p>
      </div>

      <AdminTable
        rows={disputes}
        columns={columns}
        sectionKey="disputes"
        onRowAction={onRowAction}
        searchPlaceholder="Search disputes..."
        extraActions={[
          { key: 'resolve', label: '✓', title: 'Mark resolved' },
          { key: 'escalate', label: '⬆', title: 'Escalate' },
          { key: 'reject', label: '✗', title: 'Reject dispute' },
        ]}
      />
    </div>
  );
}

// ─── Shared Table ──────────────────────────────────────────────────────────────

function AdminTable({ rows = [], columns = [], sectionKey, onRowAction, searchPlaceholder = 'Search...', extraActions = [], pageSize = 20 }) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState(columns[0]?.key || 'id');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ALL');

  const STATUS_FILTERS = ['ALL', 'OPEN', 'PENDING', 'RESOLVED', 'REJECTED'];

  const filtered = useMemo(() => {
    let list = rows;

    if (statusFilter !== 'ALL') {
      list = list.filter((r) => String(r.status || '').toUpperCase() === statusFilter);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((row) =>
        columns.some((c) => String(row?.[c.key] ?? '').toLowerCase().includes(q))
      );
    }

    return list;
  }, [rows, columns, query, statusFilter]);

  const sorted = useMemo(() => {
    const next = [...filtered];
    next.sort((a, b) => {
      const av = a?.[sortKey];
      const bv = b?.[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    return next;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
    setPage(1);
  }

  return (
    <div>
      {/* Status filter chips */}
      <div style={s.chipRow}>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => { setStatusFilter(f); setPage(1); }}
            style={{ ...s.chip, ...(statusFilter === f ? s.chipActive : null) }}
          >
            {f === 'ALL' ? 'All' : capitalize(f)}
          </button>
        ))}
      </div>

      <div style={s.toolbar}>
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }}
          placeholder={searchPlaceholder}
          style={s.search}
        />
        <span style={s.count}>{filtered.length} results</span>
      </div>

      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} style={s.th}>
                  <button type="button" onClick={() => toggleSort(c.key)} style={s.sortBtn}>
                    {c.label}
                    <span style={s.sortArrow}>{sortKey === c.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span>
                  </button>
                </th>
              ))}
              <th style={s.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} style={s.emptyCell}>No disputes found.</td>
              </tr>
            )}
            {paginated.map((row, idx) => (
              <tr
                key={row.id || `${sectionKey}-${idx}`}
                className="admin-row"
                style={{
                  ...s.tr,
                  ...(['OPEN', 'PENDING'].includes(String(row.status || '').toUpperCase()) ? s.trHighlight : null),
                }}
              >
                {columns.map((c) => (
                  <td key={c.key} style={s.td}>
                    {c.render ? c.render(row?.[c.key], row) : strVal(row?.[c.key])}
                  </td>
                ))}
                <td style={s.td}>
                  <div style={s.actions}>
                    <button type="button" style={s.iconBtn} title="View" onClick={() => onRowAction?.('view', row)}>👁</button>
                    {extraActions.map((a) => (
                      <button key={a.key} type="button" style={s.iconBtn} title={a.title} onClick={() => onRowAction?.(a.key, row)}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={s.pagination}>
        <span style={s.pageInfo}>Page {safePage} / {totalPages}</span>
        <div style={s.pageBtns}>
          <button type="button" style={s.pageBtn} disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <button type="button" style={s.pageBtn} disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function col(key, label, render) { return { key, label, render }; }

function truncate(v, len = 12) {
  const str = String(v || '');
  return str.length > len ? `${str.slice(0, len)}…` : str || '—';
}

function strVal(v) {
  if (v == null) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function fmtDate(value) {
  if (!value) return '—';
  const ms = typeof value?.toDate === 'function' ? value.toDate().getTime() : new Date(value).getTime();
  if (!Number.isFinite(ms)) return '—';
  return new Date(ms).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status) {
  const map = {
    OPEN: { bg: 'rgba(239,68,68,0.18)', color: '#EF4444' },
    PENDING: { bg: 'rgba(245,158,11,0.18)', color: '#F59E0B' },
    RESOLVED: { bg: 'rgba(34,197,94,0.18)', color: '#22C55E' },
    REJECTED: { bg: 'rgba(150,160,181,0.15)', color: '#96A0B5' },
    ESCALATED: { bg: 'rgba(124,58,237,0.18)', color: '#A78BFA' },
  };
  const t = map[String(status || '').toUpperCase()] || { bg: 'rgba(150,160,181,0.12)', color: '#96A0B5' };
  return <span style={{ ...sBadge, backgroundColor: t.bg, color: t.color }}>{status || '—'}</span>;
}

const sBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  borderRadius: 999,
  padding: '2px 9px',
  fontSize: 11,
  fontWeight: 600,
};

// ─── Styles ────────────────────────────────────────────────────────────────────

const cssText = `
  * { box-sizing: border-box; }
  .admin-row:hover { background: rgba(255,255,255,0.045) !important; }
`;

const s = {
  page: { minHeight: '100vh', background: '#07090D', color: '#E8EEF8', fontFamily: "'Inter', sans-serif", padding: '28px 24px' },
  header: { marginBottom: 24 },
  backBtn: { background: 'transparent', border: 'none', color: '#00D4AA', fontSize: 13, cursor: 'pointer', marginBottom: 12, padding: 0 },
  title: { margin: '0 0 4px', fontSize: 28, fontWeight: 800, color: '#E8EEF8' },
  alertBadge: { background: 'rgba(239,68,68,0.2)', color: '#EF4444', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 700 },
  subtitle: { margin: 0, fontSize: 13, color: '#96A0B5' },
  chipRow: { display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  chip: { border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#96A0B5', borderRadius: 999, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  chipActive: { border: '1px solid rgba(0,212,170,0.5)', background: 'rgba(0,212,170,0.15)', color: '#00D4AA' },
  toolbar: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  search: { flex: 1, maxWidth: 320, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#E8EEF8', padding: '8px 12px', fontSize: 13, outline: 'none' },
  count: { fontSize: 12, color: '#647089' },
  tableWrap: { overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', whiteSpace: 'nowrap' },
  sortBtn: { background: 'transparent', border: 'none', color: '#96A0B5', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, padding: 0, textTransform: 'uppercase', letterSpacing: '0.06em' },
  sortArrow: { opacity: 0.5 },
  tr: { borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 120ms' },
  trHighlight: { borderLeft: '3px solid rgba(239,68,68,0.6)' },
  td: { padding: '9px 14px', fontSize: 13, color: '#CBD5E1', verticalAlign: 'middle' },
  emptyCell: { padding: '28px', textAlign: 'center', color: '#647089', fontSize: 13 },
  actions: { display: 'flex', gap: 4 },
  iconBtn: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#96A0B5', width: 30, height: 30, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, padding: '0 2px' },
  pageInfo: { fontSize: 12, color: '#647089' },
  pageBtns: { display: 'flex', gap: 8 },
  pageBtn: { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#E8EEF8', padding: '6px 14px', fontSize: 13, cursor: 'pointer' },
};
