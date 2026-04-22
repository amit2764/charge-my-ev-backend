import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import useSessionHistory from '../hooks/useSessionHistory';
import { resolveBookingState } from '../resolveBookingState';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

const PULSE_CSS = `@keyframes evSkPulse{0%,100%{opacity:.7}50%{opacity:.3}}.ev-sk{animation:evSkPulse 1.5s ease-in-out infinite;border-radius:4px}`;

export default function SessionHistoryScreen({
  role = 'user',
  booking = null,
  myUserId,
  onValidateVisibility,
  onExitFallback,
  onPrimaryAction,
  onExitForNow,
}) {
  const { user } = useStore();
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const isHindi = locale === 'hi';
  const s = makeStyles(c);
  const userId = myUserId || user;
  const [pullDistance, setPullDistance] = useState(0);
  const listRef = useRef(null);
  const touchStartY = useRef(null);
  const threshold = 64;
  const loadingMoreLock = useRef(false);

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  const {
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    range,
    setRange,
    refresh,
    loadMore
  } = useSessionHistory({ userId, role, pageSize: 20 });

  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = PULSE_CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  useEffect(() => {
    const resolved = resolveBookingState(booking, userId);
    onValidateVisibility?.(resolved);
    if (booking && resolved.screen !== 'HOME') {
      onExitFallback?.(resolved);
    }
  }, [booking, userId, onValidateVisibility, onExitFallback]);

  useEffect(() => {
    loadingMoreLock.current = false;
  }, [loadingMore]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore || refreshing) return undefined;
    const target = listRef.current;
    if (!target || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (!first?.isIntersecting) return;
      if (loadingMoreLock.current) return;
      loadingMoreLock.current = true;
      void loadMore();
    }, { rootMargin: '200px' });

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, refreshing, loadMore]);

  const handleTouchStart = (event) => {
    if (window.scrollY > 0 || refreshing || loading) return;
    touchStartY.current = event.touches?.[0]?.clientY ?? null;
  };

  const handleTouchMove = (event) => {
    if (touchStartY.current === null || window.scrollY > 0) return;
    const currentY = event.touches?.[0]?.clientY ?? touchStartY.current;
    const delta = Math.max(0, currentY - touchStartY.current);
    setPullDistance(Math.min(100, delta));
  };

  const handleTouchEnd = () => {
    if (touchStartY.current !== null && pullDistance >= threshold && !refreshing && !loading) {
      void refresh();
    }
    touchStartY.current = null;
    setPullDistance(0);
  };

  const chipDefs = [
    { key: 'all', label: tx('history.all', 'All') },
    { key: '7', label: tx('history.thisWeek', 'This Week') },
    { key: '30', label: tx('history.thisMonth', 'This Month') },
  ];

  const emptyPrimaryLabel = role === 'host'
    ? tx('history.addCharger', 'Add your charger')
    : tx('history.findCharger', 'Find a charger');
  const title = tx('history.title', 'Session History');
  const rows = useMemo(() => items.map(normalizeHistoryItem), [items]);

  return (
    <div
      style={s.page}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div style={s.container}>
        {(pullDistance > 0 || refreshing) && (
          <p style={s.pullHint}>
            {refreshing
              ? tx('history.refreshing', 'Refreshing...')
              : pullDistance >= threshold
                ? tx('history.release', 'Release to refresh')
                : tx('history.pull', 'Pull to refresh')}
          </p>
        )}

        <div style={s.headerRow}>
          <h1 style={s.title}>{title}</h1>
          <button type="button" style={s.closeBtn} onClick={() => onExitForNow?.()}>
            {tx('history.close', 'Close')}
          </button>
        </div>

        <div style={s.chipsRow}>
          {chipDefs.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setRange(chip.key)}
              style={range === chip.key ? s.chipActive : s.chip}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {error && <p style={s.error}>{error}</p>}

        {loading && rows.length === 0 && (
          <div style={s.listCard}>
            {[...Array(6)].map((_, idx) => <SessionHistoryRowSkeleton key={idx} s={s} />)}
          </div>
        )}

        {!loading && rows.length === 0 && (
          <div style={s.emptyWrap}>
            <div style={s.boltWrap}>âš¡</div>
            <p style={s.emptyTitle}>{tx('history.noSessions', 'No sessions yet')}</p>
            <p style={s.emptySub}>{isHindi ? 'à¤…à¤­à¥€ à¤¤à¤• à¤•à¥‹à¤ˆ à¤¸à¥‡à¤¶à¤¨ à¤¨à¤¹à¥€à¤‚' : 'Your sessions will appear here'}</p>
            <button type="button" style={s.primaryBtn} onClick={() => onPrimaryAction?.()}>
              {emptyPrimaryLabel}
            </button>
          </div>
        )}

        {rows.length > 0 && (
          <div style={s.listCard}>
            {rows.map((item, idx) => (
              <SessionHistoryRow
                key={item.id || `${item.day}-${item.month}-${idx}`}
                item={item}
                isLast={idx === rows.length - 1}
                s={s}
                c={c}
              />
            ))}
          </div>
        )}

        {rows.length > 0 && hasMore && (
          <div ref={listRef} style={s.footerText}>
            {loadingMore
              ? tx('history.loadingMore', 'Loading more sessions...')
              : tx('history.scrollMore', 'Scroll to load more')}
          </div>
        )}

        {rows.length > 0 && !hasMore && !loading && (
          <p style={s.caughtUp}>{tx('history.caughtUp', 'You are all caught up.')}</p>
        )}
      </div>
    </div>
  );
}

function normalizeHistoryItem(item = {}) {
  const dt = parseDate(item.completedAt || item.endTime || item.date || item.updatedAt || item.createdAt);
  const day = dt ? dt.toLocaleString('en-IN', { day: '2-digit' }) : '--';
  const month = dt ? dt.toLocaleString('en-IN', { month: 'short' }).toUpperCase() : '---';
  const name = item.otherPartyName || item.name || 'Unknown';
  const chargerType = item.chargerType || item.chargingMode || 'AC Charger';
  const amount = item.finalAmount ?? item.amount ?? 0;
  const kwh = Number(item.kwh ?? item.energyKwh ?? item.deliveredKwh ?? 0);
  const paymentStatus = String(item.paymentStatus || item.payment?.status || '').toUpperCase();
  const bookingStatus = String(item.status || '').toUpperCase();
  const badge = bookingStatus !== 'COMPLETED' && (paymentStatus === 'EXPIRED' || paymentStatus === 'REQUIRES_SUPPORT')
    ? paymentStatus
    : null;
  const rating = item.myRating ?? item.rating;

  return { ...item, day, month, name, chargerType, amount, kwh, badge, rating };
}

function parseDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') {
    const d = value.toDate();
    return Number.isFinite(d.getTime()) ? d : null;
  }
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(ms);
}

function SessionHistoryRow({ item, isLast, s, c }) {
  const hasRating = Number.isFinite(Number(item.rating));
  const rating = Math.max(0, Math.min(5, Math.round(Number(item.rating || 0))));
  return (
    <div style={{ ...s.row, ...(isLast ? {} : s.rowBorder) }}>
      <div style={s.dateCol}>
        <p style={s.dateDay}>{item.day}</p>
        <p style={s.dateMonth}>{item.month}</p>
      </div>

      <div style={s.centerCol}>
        <div style={s.topMeta}>
          {item.avatar
            ? <img src={item.avatar} alt="" style={s.avatarImg} referrerPolicy="no-referrer" />
            : <div style={s.avatarFallback}>{initials(item.name)}</div>}
          <div style={s.nameWrap}>
            <p style={s.rowName}>{item.name}</p>
            <p style={s.rowCharger}>{item.chargerType}</p>
          </div>
        </div>

        {item.badge && (
          <span style={item.badge === 'EXPIRED' ? s.badgeExpired : s.badgeSupport}>
            {item.badge}
          </span>
        )}

        {hasRating && (
          <div style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <span key={n} style={n <= rating ? {} : { color: c.textSoft }}>â˜…</span>
            ))}
          </div>
        )}
      </div>

      <div style={s.rightCol}>
        <p style={s.amount}>â‚¹{Number(item.amount || 0).toFixed(0)}</p>
        <p style={s.kwh}>{Number(item.kwh || 0).toFixed(2)} kWh</p>
      </div>
    </div>
  );
}

function SessionHistoryRowSkeleton({ s }) {
  return (
    <div style={{ ...s.row, ...s.rowBorder }}>
      <div style={s.dateCol}>
        <div className="ev-sk" style={s.skDay} />
        <div className="ev-sk" style={{ ...s.skMonth, marginTop: 8 }} />
      </div>
      <div style={s.centerCol}>
        <div style={s.topMeta}>
          <div className="ev-sk" style={s.skAvatar} />
          <div style={s.nameWrap}>
            <div className="ev-sk" style={s.skLineLg} />
            <div className="ev-sk" style={{ ...s.skLineSm, marginTop: 8 }} />
          </div>
        </div>
        <div className="ev-sk" style={{ ...s.skBadge, marginTop: 8 }} />
      </div>
      <div style={s.rightCol}>
        <div className="ev-sk" style={s.skAmt} />
        <div className="ev-sk" style={{ ...s.skKwh, marginTop: 8 }} />
      </div>
    </div>
  );
}

function initials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function makeStyles(c) {
  return {
    page: {
      minHeight: '100dvh',
      background: c.page,
      color: c.text,
      padding: '20px 16px 24px',
      fontFamily: "'Inter', sans-serif",
    },
    container: {
      maxWidth: 430,
      margin: '0 auto',
      width: '100%',
    },
    pullHint: {
      textAlign: 'center',
      fontSize: 12,
      color: c.brandPrimary,
      marginBottom: 12,
    },
    headerRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 16,
    },
    title: {
      margin: 0,
      fontSize: 26,
      fontWeight: 800,
      lineHeight: 1.1,
      color: c.text,
    },
    closeBtn: {
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      padding: '8px 12px',
      fontSize: 12,
      fontWeight: 600,
      color: c.textMuted,
      background: 'transparent',
      cursor: 'pointer',
    },
    chipsRow: {
      display: 'flex',
      gap: 8,
      marginBottom: 16,
    },
    chip: {
      borderRadius: 999,
      border: `1px solid ${c.border}`,
      background: c.surface,
      color: c.textMuted,
      padding: '8px 16px',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
    },
    chipActive: {
      borderRadius: 999,
      border: `1px solid ${c.brandPrimary}`,
      background: c.brandPrimarySoft,
      color: c.brandPrimary,
      padding: '8px 16px',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
    },
    error: {
      marginBottom: 12,
      fontSize: 13,
      color: c.error,
    },
    listCard: {
      border: `1px solid ${c.border}`,
      borderRadius: 16,
      background: c.surface,
      padding: '0 12px',
    },
    emptyWrap: {
      border: `1px solid ${c.border}`,
      borderRadius: 16,
      background: c.surface,
      padding: '40px 16px',
      textAlign: 'center',
    },
    boltWrap: {
      width: 56,
      height: 56,
      borderRadius: 16,
      border: `1px solid ${c.brandPrimary}66`,
      background: c.brandPrimarySoft,
      display: 'grid',
      placeItems: 'center',
      fontSize: 24,
      color: c.brandPrimary,
      margin: '0 auto 12px',
    },
    emptyTitle: {
      margin: 0,
      fontSize: 18,
      fontWeight: 700,
      color: c.text,
    },
    emptySub: {
      margin: '4px 0 20px',
      fontSize: 13,
      color: c.textMuted,
    },
    primaryBtn: {
      border: 'none',
      borderRadius: 12,
      background: c.brandPrimary,
      color: c.page,
      padding: '12px 16px',
      fontSize: 14,
      fontWeight: 700,
      cursor: 'pointer',
    },
    row: {
      display: 'grid',
      gridTemplateColumns: '48px 1fr auto',
      gap: 12,
      padding: '12px 0',
    },
    rowBorder: {
      borderBottom: `1px solid ${c.border}`,
    },
    dateCol: { textAlign: 'center' },
    dateDay: { margin: 0, fontSize: 18, fontWeight: 800, color: c.text, lineHeight: 1 },
    dateMonth: { margin: '4px 0 0', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: c.textMuted },
    centerCol: { minWidth: 0 },
    topMeta: { display: 'flex', alignItems: 'center', gap: 8 },
    avatarImg: { width: 32, height: 32, borderRadius: 16, objectFit: 'cover', flexShrink: 0 },
    avatarFallback: {
      width: 32,
      height: 32,
      borderRadius: 16,
      background: c.brandPrimarySoft,
      color: c.brandPrimary,
      display: 'grid',
      placeItems: 'center',
      fontSize: 11,
      fontWeight: 700,
      flexShrink: 0,
    },
    nameWrap: { minWidth: 0 },
    rowName: { margin: 0, fontSize: 14, fontWeight: 700, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    rowCharger: { margin: 0, fontSize: 12, color: c.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    badgeExpired: {
      display: 'inline-block',
      marginTop: 6,
      borderRadius: 999,
      padding: '2px 8px',
      fontSize: 10,
      fontWeight: 700,
      background: c.warningSoft,
      color: c.warning,
    },
    badgeSupport: {
      display: 'inline-block',
      marginTop: 6,
      borderRadius: 999,
      padding: '2px 8px',
      fontSize: 10,
      fontWeight: 700,
      background: c.errorSoft,
      color: c.error,
    },
    starsRow: { display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, marginTop: 8, color: c.brandPrimary },
    rightCol: { textAlign: 'right' },
    amount: { margin: 0, fontSize: 14, fontWeight: 800, color: c.success },
    kwh: { margin: '4px 0 0', fontSize: 12, color: c.textMuted },
    footerText: { textAlign: 'center', padding: '16px 0', fontSize: 12, color: c.textMuted },
    caughtUp: { textAlign: 'center', padding: '16px 0', fontSize: 12, color: c.textSoft },
    skDay: { height: 16, width: 32, background: c.skeletonBase },
    skMonth: { height: 12, width: 40, background: c.skeletonBase },
    skAvatar: { width: 32, height: 32, borderRadius: 16, background: c.skeletonBase, flexShrink: 0 },
    skLineLg: { height: 12, width: 96, background: c.skeletonBase },
    skLineSm: { height: 12, width: 64, background: c.skeletonBase },
    skBadge: { height: 16, width: 56, background: c.skeletonBase, borderRadius: 999 },
    skAmt: { height: 14, width: 56, background: c.skeletonBase, marginLeft: 'auto' },
    skKwh: { height: 12, width: 40, background: c.skeletonBase, marginLeft: 'auto' },
  };
}
