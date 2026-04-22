import React, { useEffect, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useStore } from '../store';
import useSessionHistory from '../hooks/useSessionHistory';
import { resolveBookingState } from '../resolveBookingState';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n';

/**
 * Screen 15 — Session History Screen (Native)
 */
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
  const { c } = useTheme();
  const { t } = useI18n();
  const s = makeStyles(c);
  const userId = myUserId || user;

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
    loadMore,
  } = useSessionHistory({ userId, role, pageSize: 20 });

  useEffect(() => {
    const resolved = resolveBookingState(booking, userId);
    onValidateVisibility?.(resolved);
    if (booking && resolved.screen !== 'HOME') {
      onExitFallback?.(resolved);
    }
  }, [booking, userId, onValidateVisibility, onExitFallback]);

  const rows = useMemo(() => items.map(normalizeHistoryItem), [items]);
  const chipDefs = [
    { key: 'all', label: tx('history.all', 'All') },
    { key: '7', label: tx('history.thisWeek', 'This Week') },
    { key: '30', label: tx('history.thisMonth', 'This Month') },
  ];

  const emptyPrimaryLabel = role === 'host' ? tx('history.addCharger', 'Add your charger') : tx('history.findCharger', 'Find a charger');

  return (
    <View style={s.page}>
      <View style={s.headerRow}>
        <Text style={s.title}>Session History</Text>
        <Pressable style={s.closeBtn} onPress={() => onExitForNow?.()}>
          <Text style={s.closeText}>{tx('history.close', 'Close')}</Text>
        </Pressable>
      </View>

      <View style={s.chipsRow}>
        {chipDefs.map((chip) => {
          const active = range === chip.key;
          return (
            <Pressable
              key={chip.key}
              style={[s.chip, active && s.chipActive]}
              onPress={() => setRange(chip.key)}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{chip.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {!!error && <Text style={s.error}>{error}</Text>}

      {loading && rows.length === 0 ? (
        <View style={s.listCard}>
          {[...Array(6)].map((_, idx) => <SessionHistoryRowSkeleton key={String(idx)} s={s} />)}
        </View>
      ) : rows.length === 0 ? (
        <View style={s.emptyWrap}>
          <View style={s.boltWrap}><Text style={s.bolt}>⚡</Text></View>
          <Text style={s.emptyTitle}>No sessions yet</Text>
          <Text style={s.emptySub}>अभी तक कोई सेशन नहीं</Text>
          <Pressable style={s.primaryBtn} onPress={() => onPrimaryAction?.()}>
            <Text style={s.primaryBtnText}>{emptyPrimaryLabel}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, index) => item.id || `${item.day}-${item.month}-${index}`}
          contentContainerStyle={s.listCard}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={c.brandPrimary} />}
          renderItem={({ item, index }) => (
            <SessionHistoryRow item={item} isLast={index === rows.length - 1} s={s} c={c} />
          )}
          onEndReachedThreshold={0.3}
          onEndReached={() => {
            if (!loadingMore && hasMore) {
              void loadMore();
            }
          }}
          ListFooterComponent={
            hasMore
              ? <Text style={s.footerText}>{loadingMore ? tx('history.loadingMore', 'Loading more sessions...') : tx('history.scrollMore', 'Scroll to load more')}</Text>
              : <Text style={s.footerText}>{tx('history.caughtUp', 'You are all caught up.')}</Text>
          }
        />
      )}
    </View>
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

  return {
    ...item,
    day,
    month,
    name,
    chargerType,
    amount,
    kwh,
    badge,
    rating,
  };
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

function SessionHistoryRow({ item, isLast, s }) {
  const hasRating = Number.isFinite(Number(item.rating));
  const rating = Math.max(0, Math.min(5, Math.round(Number(item.rating || 0))));

  return (
    <View style={[s.row, !isLast && s.rowBorder]}>
      <View style={s.dateCol}>
        <Text style={s.day}>{item.day}</Text>
        <Text style={s.month}>{item.month}</Text>
      </View>

      <View style={s.centerCol}>
        <View style={s.topMeta}>
          <View style={s.avatarFallback}><Text style={s.avatarInitials}>{initials(item.name)}</Text></View>
          <View style={s.nameWrap}>
            <Text numberOfLines={1} style={s.name}>{item.name}</Text>
            <Text numberOfLines={1} style={s.chargerType}>{item.chargerType}</Text>
          </View>
        </View>

        {!!item.badge && (
          <View style={[s.badge, item.badge === 'EXPIRED' ? s.badgeExpired : s.badgeSupport]}>
            <Text style={[s.badgeText, item.badge === 'EXPIRED' ? s.badgeTextExpired : s.badgeTextSupport]}>{item.badge}</Text>
          </View>
        )}

        {hasRating && (
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Text key={String(n)} style={[s.star, n <= rating ? s.starActive : s.starIdle]}>★</Text>
            ))}
          </View>
        )}
      </View>

      <View style={s.rightCol}>
        <Text style={s.amount}>₹{Number(item.amount || 0).toFixed(0)}</Text>
        <Text style={s.kwh}>{Number(item.kwh || 0).toFixed(2)} kWh</Text>
      </View>
    </View>
  );
}

function SessionHistoryRowSkeleton({ s }) {
  return (
    <View style={[s.row, s.rowBorder]}>
      <View style={s.dateCol}>
        <View style={s.skDay} />
        <View style={s.skMonth} />
      </View>
      <View style={s.centerCol}>
        <View style={s.topMeta}>
          <View style={s.skAvatar} />
          <View style={s.nameWrap}>
            <View style={s.skLineLg} />
            <View style={s.skLineSm} />
          </View>
        </View>
        <View style={s.skBadge} />
      </View>
      <View style={s.rightCol}>
        <View style={s.skAmt} />
        <View style={s.skKwh} />
      </View>
    </View>
  );
}

function initials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function makeStyles(c) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: c.page,
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 18,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    title: {
      color: c.text,
      fontSize: 28,
      fontWeight: '800',
    },
    closeBtn: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    closeText: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    chipsRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 12,
    },
    chip: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 999,
      backgroundColor: c.surface,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    chipActive: {
      borderColor: c.brandPrimary,
      backgroundColor: c.brandPrimarySoft,
    },
    chipText: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    chipTextActive: {
      color: c.brandPrimary,
    },
    error: {
      color: c.error,
      fontSize: 13,
      marginBottom: 10,
    },
    listCard: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      backgroundColor: c.surface,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    emptyWrap: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 16,
      backgroundColor: c.surface,
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 42,
    },
    boltWrap: {
      width: 56,
      height: 56,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.brandPrimary,
      backgroundColor: c.brandPrimarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    bolt: {
      color: c.brandPrimary,
      fontSize: 24,
    },
    emptyTitle: {
      color: c.text,
      fontSize: 21,
      fontWeight: '700',
      marginBottom: 4,
    },
    emptySub: {
      color: c.textMuted,
      fontSize: 14,
      marginBottom: 18,
    },
    primaryBtn: {
      backgroundColor: c.brandPrimary,
      borderRadius: 12,
      minHeight: 46,
      paddingHorizontal: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: {
      color: c.page,
      fontSize: 14,
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 11,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    dateCol: {
      width: 48,
      alignItems: 'center',
    },
    day: {
      color: c.text,
      fontSize: 18,
      fontWeight: '800',
      lineHeight: 19,
    },
    month: {
      color: c.textMuted,
      marginTop: 3,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1,
    },
    centerCol: {
      flex: 1,
    },
    topMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    avatarFallback: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.brandPrimarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      color: c.brandPrimary,
      fontSize: 11,
      fontWeight: '700',
    },
    nameWrap: {
      flex: 1,
    },
    name: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },
    chargerType: {
      color: c.textMuted,
      fontSize: 12,
      marginTop: 1,
    },
    rightCol: {
      alignItems: 'flex-end',
    },
    amount: {
      color: c.success,
      fontSize: 14,
      fontWeight: '800',
    },
    kwh: {
      color: c.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    badge: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginTop: 6,
    },
    badgeExpired: {
      backgroundColor: c.warningSoft,
    },
    badgeSupport: {
      backgroundColor: c.errorSoft,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '700',
    },
    badgeTextExpired: {
      color: c.warning,
    },
    badgeTextSupport: {
      color: c.error,
    },
    starsRow: {
      flexDirection: 'row',
      gap: 1,
      marginTop: 5,
    },
    star: {
      fontSize: 13,
    },
    starActive: {
      color: c.brandPrimary,
    },
    starIdle: {
      color: c.textSoft,
    },
    footerText: {
      color: c.textMuted,
      fontSize: 12,
      textAlign: 'center',
      paddingVertical: 12,
    },
    skDay: {
      height: 16,
      width: 28,
      borderRadius: 4,
      backgroundColor: c.skeletonBase,
    },
    skMonth: {
      marginTop: 6,
      height: 12,
      width: 34,
      borderRadius: 4,
      backgroundColor: c.skeletonBase,
    },
    skAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.skeletonBase,
    },
    skLineLg: {
      height: 12,
      width: 96,
      borderRadius: 4,
      backgroundColor: c.skeletonBase,
    },
    skLineSm: {
      height: 12,
      width: 68,
      borderRadius: 4,
      backgroundColor: c.skeletonBase,
      marginTop: 6,
    },
    skBadge: {
      marginTop: 8,
      height: 14,
      width: 58,
      borderRadius: 999,
      backgroundColor: c.skeletonBase,
    },
    skAmt: {
      height: 14,
      width: 60,
      borderRadius: 4,
      backgroundColor: c.skeletonBase,
    },
    skKwh: {
      marginTop: 7,
      height: 12,
      width: 48,
      borderRadius: 4,
      backgroundColor: c.skeletonBase,
    },
  });
}
