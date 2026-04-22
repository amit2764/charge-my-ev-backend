import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import api from '../api';
import { resolveBookingState } from '../resolveBookingState';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

const NOW_STATIC_MS = Date.now();

/**
 * Screen 16 — Session Detail Screen (Native)
 */
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
  onReport,
}) {
  const { t, locale } = useI18n();
  const { c } = useTheme();
  const isHindi = locale === 'hi';
  const s = makeStyles(c);

  const [menuOpen, setMenuOpen] = useState(false);
  const [dispute, setDispute] = useState(null);

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

  const otherPartyName = safeItem.otherPartyName || (role === 'host' ? 'User' : 'Host');
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
    <View style={s.page}>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.headerRow}>
          <Pressable style={s.iconBtn} onPress={() => onBack?.()}>
            <Text style={s.iconText}>←</Text>
          </Pressable>
          <Text style={s.title}>{tx('sessionDetail.title', isHindi ? 'सेशन डिटेल्स' : 'Session Details')}</Text>

          <View>
            <Pressable style={s.iconBtn} onPress={() => setMenuOpen((v) => !v)}>
              <Text style={s.iconText}>⋯</Text>
            </Pressable>
            {menuOpen && (
              <View style={s.menu}>
                <Pressable
                  style={s.menuItem}
                  onPress={() => {
                    setMenuOpen(false);
                    onReport?.(safeItem);
                  }}
                >
                  <Text style={s.menuText}>{tx('sessionDetail.report', isHindi ? 'रिपोर्ट करें' : 'Report')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={[s.badge, statusLabel.kind === 'completed' ? s.badgeCompleted : statusLabel.kind === 'expired' ? s.badgeExpired : s.badgeSupport]}>
          <Text style={[s.badgeText, statusLabel.kind === 'completed' ? s.badgeCompletedText : statusLabel.kind === 'expired' ? s.badgeExpiredText : s.badgeSupportText]}>{statusLabel.text}</Text>
        </View>

        <View style={s.card}>
          <View style={s.partyRow}>
            <View style={s.avatarFallback}><Text style={s.avatarInitials}>{initials(otherPartyName)}</Text></View>
            <View style={s.partyBody}>
              <Text style={s.partyName}>{otherPartyName}</Text>
              <View style={s.partyMetaRow}>
                <Text style={s.partyMeta}>{Number.isFinite(otherRating) ? `★ ${otherRating.toFixed(1)}` : '★ -'}</Text>
                {isVerified && (
                  <View style={s.verifiedPill}>
                    <Text style={s.verifiedText}>Verified</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={s.grid}>
          {stats.map((it) => (
            <View key={it.label} style={s.gridCard}>
              <Text style={s.gridLabel}>{it.label}</Text>
              <Text style={s.gridValue}>{it.value}</Text>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>{tx('sessionDetail.timeline', isHindi ? 'टाइमलाइन' : 'Timeline')}</Text>
          {timeline.map((step, idx) => (
            <View key={step.label} style={s.timelineRow}>
              <View style={s.timelineCol}>
                <View style={s.timelineDot} />
                {idx !== timeline.length - 1 && <View style={s.timelineLine} />}
              </View>
              <View style={s.timelineTextWrap}>
                <Text style={s.timelineLabel}>{step.label}</Text>
                <Text style={s.timelineTime}>{formatDate(step.value)}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.sectionTitle}>{tx('sessionDetail.receipt', isHindi ? 'रसीद' : 'Receipt')}</Text>
          <ReceiptRow label={tx('sessionDetail.baseAmount', isHindi ? 'बेस अमाउंट' : 'Base amount')} value={`₹${baseAmount.toFixed(0)}`} s={s} />
          <ReceiptRow label={tx('sessionDetail.promoDiscount', isHindi ? 'प्रोमो छूट' : 'Promo discount')} value={`-₹${promoDiscount.toFixed(0)}`} s={s} />
          <ReceiptRow label={tx('sessionDetail.platformFee', isHindi ? 'प्लेटफ़ॉर्म शुल्क' : 'Platform fee')} value={`₹${platformFee.toFixed(0)}`} s={s} />
          <ReceiptRow label={tx('sessionDetail.total', isHindi ? 'कुल' : 'Total')} value={`₹${total.toFixed(0)}`} strong s={s} />

          <Pressable style={s.downloadBtn} onPress={() => onDownloadReceipt?.(safeItem)}>
            <Text style={s.downloadBtnText}>{tx('sessionDetail.downloadReceipt', isHindi ? 'रसीद डाउनलोड करें' : 'Download Receipt')}</Text>
          </Pressable>
        </View>

        {canRaiseDispute && !dispute && (
          <Pressable style={s.disputeBtn} onPress={() => onRaiseDispute?.(safeItem)}>
            <Text style={s.disputeBtnText}>{tx('sessionDetail.raiseDispute', isHindi ? 'विवाद उठाएं' : 'Raise a dispute')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function ReceiptRow({ label, value, strong = false, s }) {
  return (
    <View style={s.receiptRow}>
      <Text style={strong ? s.receiptLabelStrong : s.receiptLabel}>{label}</Text>
      <Text style={strong ? s.receiptValueStrong : s.receiptValue}>{value}</Text>
    </View>
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
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: c.page,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 26,
      gap: 12,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    iconBtn: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    iconText: {
      color: c.textMuted,
      fontSize: 16,
      fontWeight: '700',
    },
    title: {
      color: c.text,
      fontSize: 20,
      fontWeight: '800',
    },
    menu: {
      position: 'absolute',
      top: 40,
      right: 0,
      width: 132,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surfaceRaised,
      padding: 4,
      zIndex: 20,
    },
    menuItem: {
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    menuText: {
      color: c.textMuted,
      fontSize: 13,
    },
    badge: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    badgeCompleted: { backgroundColor: c.successSoft },
    badgeExpired: { backgroundColor: c.warningSoft },
    badgeSupport: { backgroundColor: c.errorSoft },
    badgeCompletedText: { color: c.success },
    badgeExpiredText: { color: c.warning },
    badgeSupportText: { color: c.error },
    card: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      backgroundColor: c.surface,
      padding: 14,
    },
    partyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    avatarFallback: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.brandPrimarySoft,
    },
    avatarInitials: {
      color: c.brandPrimary,
      fontSize: 16,
      fontWeight: '700',
    },
    partyBody: {
      flex: 1,
    },
    partyName: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
    },
    partyMetaRow: {
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    partyMeta: {
      color: c.textMuted,
      fontSize: 12,
    },
    verifiedPill: {
      borderRadius: 999,
      backgroundColor: c.brandPrimarySoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    verifiedText: {
      color: c.brandPrimary,
      fontSize: 11,
      fontWeight: '700',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    gridCard: {
      width: '48.8%',
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      backgroundColor: c.surface,
      padding: 12,
    },
    gridLabel: {
      color: c.textMuted,
      fontSize: 11,
    },
    gridValue: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 4,
    },
    sectionTitle: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 8,
    },
    timelineRow: {
      flexDirection: 'row',
    },
    timelineCol: {
      width: 20,
      alignItems: 'center',
    },
    timelineDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: c.brandPrimary,
      marginTop: 4,
    },
    timelineLine: {
      width: 1,
      flex: 1,
      backgroundColor: c.border,
      marginTop: 3,
      marginBottom: 3,
    },
    timelineTextWrap: {
      flex: 1,
      paddingBottom: 10,
    },
    timelineLabel: {
      color: c.textMuted,
      fontSize: 12,
    },
    timelineTime: {
      color: c.text,
      fontSize: 13,
      marginTop: 2,
    },
    receiptRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    receiptLabel: {
      color: c.textMuted,
      fontSize: 13,
    },
    receiptValue: {
      color: c.text,
      fontSize: 13,
    },
    receiptLabelStrong: {
      color: c.text,
      fontSize: 13,
      fontWeight: '600',
    },
    receiptValueStrong: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },
    downloadBtn: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    downloadBtnText: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    disputeBtn: {
      borderWidth: 1,
      borderColor: c.error,
      borderRadius: 12,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    disputeBtnText: {
      color: c.error,
      fontSize: 13,
      fontWeight: '700',
    },
  });
}
