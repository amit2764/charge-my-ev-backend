import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { resolveBookingState } from '../resolveBookingState';
import ReportModal from '../components/ReportModal';
import useReport from '../hooks/useReport';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

const NOW_STATIC_MS = Date.now();

export default function SessionDetailScreen({
  item,
  role = 'user',
  myUserId,
  booking = null,
  onBack,
  onValidateVisibility,
  onExitFallback,
  onDownloadReceipt,
  onRaiseDispute,
}) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const isHindi = locale === 'hi';
  const s = makeStyles(c);

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [dispute, setDispute] = useState(null);
  const { loading, submitReport, blockUser } = useReport();

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }
  const safeItem = item || {};

  useEffect(() => {
    const resolved = resolveBookingState(booking, myUserId);
    onValidateVisibility?.(resolved);
    if (booking && resolved.screen !== 'HOME') {
      onExitFallback?.(resolved);
    }
  }, [booking, myUserId, onValidateVisibility, onExitFallback]);

  const bookingId = safeItem.bookingId || safeItem.id;
  const reportedUserId = role === 'host' ? safeItem.userId : safeItem.hostId;
  const canBlock = role === 'host' && !!safeItem.userId;
  const otherPartyName = safeItem.otherPartyName || (role === 'host' ? 'User' : 'Host');

  const canReport = useMemo(() => {
    return !!myUserId && !!reportedUserId && !!bookingId;
  }, [myUserId, reportedUserId, bookingId]);

  const canRaiseDispute = useMemo(() => {
    const dateMs = toDateMs(safeItem.completedAt || safeItem.endTime || safeItem.date || safeItem.startTime);
    if (!Number.isFinite(dateMs)) return false;
    return (NOW_STATIC_MS - dateMs) <= 7 * 24 * 60 * 60 * 1000;
  }, [safeItem.completedAt, safeItem.endTime, safeItem.date, safeItem.startTime]);

  useEffect(() => {
    let cancelled = false;

    async function loadDispute() {
      if (!bookingId) return;
      try {
        const res = await api.get(`/api/disputes/booking/${encodeURIComponent(bookingId)}`);
        if (!cancelled) setDispute(res.data?.dispute || null);
      } catch {
        if (!cancelled) setDispute(null);
      }
    }

    void loadDispute();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  async function handleSubmitReport({ reason, details }) {
    if (!canReport) throw new Error('Missing report context');
    await submitReport({
      reportedBy: myUserId,
      reportedUserId,
      bookingId,
      reason,
      details,
    });
  }

  async function handleBlock() {
    if (!canBlock || !myUserId) throw new Error('Missing block context');
    await blockUser({
      hostId: myUserId,
      blockedUserId: safeItem.userId,
    });
  }

  const otherRating = Number(safeItem.otherPartyRating ?? safeItem.partyRating);
  const isVerified = !!(safeItem.otherPartyVerified ?? safeItem.verified);
  const statusLabel = getStatusLabel(safeItem);

  const stats = [
    { label: tx('sessionDetail.kwh', isHindi ? 'डिलीवर kWh' : 'kWh Delivered'), value: `${Number(safeItem.kwh || safeItem.deliveredKwh || 0).toFixed(2)} kWh` },
    { label: tx('sessionDetail.duration', isHindi ? 'अवधि' : 'Duration'), value: safeItem.durationText || `${Number(safeItem.duration || 0)} min` },
    { label: tx('sessionDetail.amount', isHindi ? 'भुगतान राशि' : 'Amount Paid'), value: `₹${Number(safeItem.finalAmount || safeItem.amount || 0).toFixed(0)}` },
    { label: tx('sessionDetail.mode', isHindi ? 'चार्जिंग मोड' : 'Charging Mode'), value: safeItem.chargingMode || 'AC' },
  ];

  const timeline = [
    { label: tx('sessionDetail.requestSent', isHindi ? 'रिक्वेस्ट भेजी गई' : 'Request sent'), value: safeItem.requestedAt || safeItem.createdAt },
    { label: tx('sessionDetail.bookingConfirmed', isHindi ? 'बुकिंग कन्फर्म' : 'Booking confirmed'), value: safeItem.bookedAt || safeItem.confirmedAt },
    { label: tx('sessionDetail.started', isHindi ? 'सेशन शुरू' : 'Session started'), value: safeItem.startTime },
    { label: tx('sessionDetail.ended', isHindi ? 'सेशन समाप्त' : 'Session ended'), value: safeItem.endTime || safeItem.completedAt },
    { label: tx('sessionDetail.paymentConfirmed', isHindi ? 'पेमेंट कन्फर्म' : 'Payment confirmed'), value: safeItem.paymentConfirmedAt || safeItem.paymentUpdatedAt || safeItem.updatedAt },
    { label: tx('sessionDetail.ratingSubmitted', isHindi ? 'रेटिंग सबमिट' : 'Rating submitted'), value: safeItem.ratedAt || safeItem.ratingCreatedAt },
  ];

  const baseAmount = Number(safeItem.baseAmount ?? safeItem.amount ?? safeItem.subtotal ?? safeItem.finalAmount ?? 0);
  const promoDiscount = Number(safeItem.promoDiscount || 0);
  const platformFee = Number(safeItem.platformFee || 0);
  const total = Number(safeItem.finalAmount ?? Math.max(0, baseAmount - promoDiscount + platformFee));

  if (!item) return null;

  return (
    <div style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <button type="button" onClick={() => onBack?.()} style={s.iconBtn} aria-label="Back">←</button>
          <h1 style={s.headerTitle}>{tx('sessionDetail.title', isHindi ? 'सेशन डिटेल्स' : 'Session Details')}</h1>
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setMenuOpen((v) => !v)} style={s.iconBtn} aria-label="More">⋯</button>
            {menuOpen && (
              <div style={s.dropdownMenu}>
                <button
                  type="button"
                  style={{ ...s.dropdownItem, ...(canReport ? {} : { opacity: 0.4 }) }}
                  onClick={() => { setMenuOpen(false); setReportOpen(true); }}
                  disabled={!canReport}
                >
                  {tx('sessionDetail.report', isHindi ? 'रिपोर्ट करें' : 'Report')}
                </button>
              </div>
            )}
          </div>
        </header>

        <span style={{
          ...s.statusBadge,
          ...(statusLabel.kind === 'completed' ? s.statusCompleted : statusLabel.kind === 'expired' ? s.statusExpired : s.statusSupport),
        }}>
          {statusLabel.text}
        </span>

        <section style={s.card}>
          <div style={s.partyRow}>
            {safeItem.otherPartyAvatar
              ? <img src={safeItem.otherPartyAvatar} alt="" style={s.partyAvatar} referrerPolicy="no-referrer" />
              : <div style={s.partyFallback}>{initials(otherPartyName)}</div>}
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={s.partyName}>{otherPartyName}</p>
              <div style={s.partyMeta}>
                <span>{Number.isFinite(otherRating) ? `★ ${otherRating.toFixed(1)}` : '★ -'}</span>
                {isVerified && <span style={s.verifiedPill}>Verified</span>}
              </div>
            </div>
          </div>
        </section>

        <section style={s.statsGrid}>
          {stats.map((st) => (
            <div key={st.label} style={s.statCard}>
              <p style={s.statLabel}>{st.label}</p>
              <p style={s.statValue}>{st.value}</p>
            </div>
          ))}
        </section>

        <section style={s.card}>
          <p style={s.sectionTitle}>{tx('sessionDetail.timeline', isHindi ? 'टाइमलाइन' : 'Timeline')}</p>
          <div>
            {timeline.map((step, idx) => (
              <div key={step.label} style={s.timelineStep}>
                <div style={s.timelineDotCol}>
                  <span style={s.timelineDot} />
                  {idx !== timeline.length - 1 && <span style={s.timelineConnector} />}
                </div>
                <div style={s.timelineContent}>
                  <p style={s.timelineLabel}>{step.label}</p>
                  <p style={s.timelineValue}>{formatDate(step.value)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section style={s.card}>
          <p style={s.sectionTitle}>{tx('sessionDetail.receipt', isHindi ? 'रसीद' : 'Receipt')}</p>
          <ReceiptRow label={tx('sessionDetail.baseAmount', isHindi ? 'बेस अमाउंट' : 'Base amount')} value={`₹${baseAmount.toFixed(0)}`} s={s} />
          <ReceiptRow label={tx('sessionDetail.promoDiscount', isHindi ? 'प्रोमो छूट' : 'Promo discount')} value={`-₹${promoDiscount.toFixed(0)}`} s={s} />
          <ReceiptRow label={tx('sessionDetail.platformFee', isHindi ? 'प्लेटफ़ॉर्म शुल्क' : 'Platform fee')} value={`₹${platformFee.toFixed(0)}`} s={s} />
          <ReceiptRow label={tx('sessionDetail.total', isHindi ? 'कुल' : 'Total')} value={`₹${total.toFixed(0)}`} strong s={s} />
          <button type="button" onClick={() => onDownloadReceipt?.(safeItem)} style={s.outlineBtn}>
            {tx('sessionDetail.downloadReceipt', isHindi ? 'रसीद डाउनलोड करें' : 'Download Receipt')}
          </button>
        </section>

        {canRaiseDispute && !dispute && (
          <button type="button" onClick={() => onRaiseDispute?.(safeItem)} style={s.disputeBtn}>
            {tx('sessionDetail.raiseDispute', isHindi ? 'विवाद उठाएं' : 'Raise a dispute')}
          </button>
        )}
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={handleSubmitReport}
        loading={loading}
        otherPartyName={otherPartyName}
        canBlock={canBlock}
        onBlock={handleBlock}
      />
    </div>
  );
}

function ReceiptRow({ label, value, strong = false, s }) {
  return (
    <div style={s.receiptRow}>
      <span style={strong ? s.receiptLabelStrong : s.receiptLabel}>{label}</span>
      <span style={strong ? s.receiptValueStrong : s.receiptValue}>{value}</span>
    </div>
  );
}

function formatDate(value) {
  const d = parseDate(value);
  if (!d) return '-';
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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

function toDateMs(value) {
  const d = parseDate(value);
  return d ? d.getTime() : Number.NaN;
}

function getStatusLabel(item) {
  const bookingStatus = String(item.status || '').toUpperCase();
  const paymentStatus = String(item.paymentStatus || item.payment?.status || '').toUpperCase();

  if (paymentStatus === 'EXPIRED') return { text: 'EXPIRED', kind: 'expired' };
  if (paymentStatus === 'REQUIRES_SUPPORT') return { text: 'REQUIRES_SUPPORT', kind: 'support' };
  if (bookingStatus === 'COMPLETED') return { text: 'COMPLETED', kind: 'completed' };
  return { text: bookingStatus || 'COMPLETED', kind: 'completed' };
}

function initials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function makeStyles(c) {
  return {
    page: {
      minHeight: '100dvh',
      background: c.page,
      padding: '20px 16px 24px',
      color: c.text,
      fontFamily: "'Inter', sans-serif",
    },
    container: {
      maxWidth: 430,
      margin: '0 auto',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconBtn: {
      borderRadius: 12,
      border: `1px solid ${c.border}`,
      padding: '8px 12px',
      fontSize: 14,
      color: c.textMuted,
      background: 'transparent',
      cursor: 'pointer',
    },
    headerTitle: {
      margin: 0,
      fontSize: 20,
      fontWeight: 800,
      color: c.text,
    },
    dropdownMenu: {
      position: 'absolute',
      right: 0,
      zIndex: 10,
      marginTop: 4,
      width: 144,
      borderRadius: 12,
      border: `1px solid ${c.border}`,
      background: c.surfaceRaised,
      padding: 4,
    },
    dropdownItem: {
      width: '100%',
      borderRadius: 8,
      padding: '8px 12px',
      textAlign: 'left',
      fontSize: 14,
      color: c.textMuted,
      background: 'transparent',
      cursor: 'pointer',
      border: 'none',
    },
    statusBadge: {
      display: 'inline-flex',
      borderRadius: 999,
      padding: '4px 12px',
      fontSize: 12,
      fontWeight: 700,
    },
    statusCompleted: { background: c.successSoft, color: c.success },
    statusExpired: { background: c.warningSoft, color: c.warning },
    statusSupport: { background: c.errorSoft, color: c.error },
    card: {
      border: `1px solid ${c.border}`,
      borderRadius: 16,
      background: c.surface,
      padding: 16,
    },
    partyRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    },
    partyAvatar: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      objectFit: 'cover',
      outline: `2px solid ${c.brandPrimary}72`,
    },
    partyFallback: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: c.brandPrimarySoft,
      color: c.brandPrimary,
      display: 'grid',
      placeItems: 'center',
      fontSize: 16,
      fontWeight: 700,
      flexShrink: 0,
    },
    partyName: {
      margin: 0,
      fontSize: 16,
      fontWeight: 700,
      color: c.text,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    partyMeta: {
      marginTop: 4,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 12,
      color: c.textMuted,
    },
    verifiedPill: {
      borderRadius: 999,
      background: c.brandPrimarySoft,
      color: c.brandPrimary,
      padding: '2px 8px',
    },
    statsGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 8,
    },
    statCard: {
      borderRadius: 12,
      border: `1px solid ${c.border}`,
      background: c.surface,
      padding: 12,
    },
    statLabel: { margin: 0, fontSize: 11, color: c.textMuted },
    statValue: { margin: '4px 0 0', fontSize: 14, fontWeight: 700, color: c.text },
    sectionTitle: {
      margin: '0 0 8px',
      fontSize: 14,
      fontWeight: 700,
      color: c.text,
    },
    timelineStep: {
      display: 'flex',
      gap: 8,
      marginBottom: 12,
    },
    timelineDotCol: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: 16,
      flexShrink: 0,
    },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: c.brandPrimary,
      marginTop: 4,
      flexShrink: 0,
    },
    timelineConnector: {
      width: 1,
      flex: 1,
      background: c.border,
      marginTop: 4,
    },
    timelineContent: { flex: 1 },
    timelineLabel: { margin: 0, fontSize: 12, color: c.textMuted },
    timelineValue: { margin: '2px 0 0', fontSize: 14, color: c.text },
    receiptRow: {
      marginTop: 4,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 14,
    },
    receiptLabel: { color: c.textMuted },
    receiptLabelStrong: { color: c.text, fontWeight: 600 },
    receiptValue: { color: c.text },
    receiptValueStrong: { color: c.text, fontWeight: 700 },
    outlineBtn: {
      marginTop: 12,
      width: '100%',
      borderRadius: 12,
      border: `1px solid ${c.border}`,
      background: 'transparent',
      padding: '12px 16px',
      fontSize: 14,
      fontWeight: 600,
      color: c.textMuted,
      cursor: 'pointer',
    },
    disputeBtn: {
      width: '100%',
      borderRadius: 12,
      border: `1px solid ${c.error}59`,
      background: 'transparent',
      padding: '12px 16px',
      fontSize: 14,
      fontWeight: 600,
      color: c.error,
      cursor: 'pointer',
    },
  };
}
