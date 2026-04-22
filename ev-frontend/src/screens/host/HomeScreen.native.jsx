import React, { useMemo, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useI18n } from '../../i18n';

/**
 * Screen 07 — Home Screen (Host, React Native)
 * Same props as web variant.
 */
export default function HomeScreen({
  host = {},
  isOnline = false,
  activeBooking = null,
  pendingRequests = [],
  earnings = { today: 0, month: 0 },
  chargers = [],
  recentActivity = [],
  activeTab = 'home',
  onToggleOnline,
  onProfilePress,
  onManageSession,
  onReviewRequests,
  onOpenEarnings,
  onAddCharger,
  onOpenCharger,
  onTabPress,
}) {
  const { t, locale } = useI18n();
  const isHindi = locale === 'hi';
  const [pulse] = useState(() => new Animated.Value(1));

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  const firstName = (host?.displayName ?? '').split(' ')[0] || tx('home.host', 'Host');
  const initials = avatarInitials(host?.displayName);
  const avatarBg = hashColor(host?.displayName || 'host');
  const pendingCount = pendingRequests?.length ?? 0;

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (isHindi) {
      if (h < 12) return 'शुभ प्रभात,';
      if (h < 17) return 'शुभ दोपहर,';
      return 'शुभ संध्या,';
    }
    if (h < 12) return 'Good morning,';
    if (h < 17) return 'Good afternoon,';
    return 'Good evening,';
  }, [isHindi]);

  React.useEffect(() => {
    if (!activeBooking) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [activeBooking, pulse]);

  const tabs = [
    { id: 'home', label: isHindi ? 'होम' : 'Home', emoji: '🏠' },
    { id: 'requests', label: isHindi ? 'अनुरोध' : 'Requests', emoji: '📥' },
    { id: 'earnings', label: isHindi ? 'कमाई' : 'Earnings', emoji: '₹' },
    { id: 'profile', label: isHindi ? 'प्रोफाइल' : 'Profile', emoji: '👤' },
  ];

  return (
    <View style={s.page}>
      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Top section */}
        <View style={s.hero}>
          <View style={s.heroTopRow}>
            <View style={s.greetingCol}>
              <Text style={s.greetingLine}>
                {greeting} <Text style={s.firstName}>{firstName}</Text>
              </Text>
              <Text style={s.heroSub}>
                {tx('host.homeSub', isHindi ? 'अपना चार्जिंग नेटवर्क मैनेज करें' : 'Manage your charging network')}
              </Text>
            </View>

            <View style={s.heroRight}>
              <TouchableOpacity onPress={() => onProfilePress?.()} activeOpacity={0.85}>
                {host?.photoURL
                  ? <Image source={{ uri: host.photoURL }} style={s.avatarImg} />
                  : <View style={[s.avatarCircle, { backgroundColor: avatarBg }]}><Text style={s.avatarInitials}>{initials}</Text></View>}
              </TouchableOpacity>

              <TouchableOpacity style={s.onlineToggle} onPress={() => onToggleOnline?.(!isOnline)} activeOpacity={0.8}>
                <View style={[s.onlineDot, { backgroundColor: isOnline ? '#22C55E' : 'rgba(255,255,255,0.35)' }]} />
                <Text style={[s.onlineText, { color: isOnline ? '#22C55E' : 'rgba(255,255,255,0.6)' }]}>
                  {isOnline ? 'Online' : 'Offline'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={s.body}>
          {/* Active session card - always first */}
          {activeBooking && (
            <View style={s.activeCard}>
              <View style={s.activeBadgeRow}>
                <Text style={s.activeBadge}>{bookingStatusLabel(activeBooking.status, isHindi)}</Text>
                <Animated.View style={[s.activePulse, { opacity: pulse }]} />
              </View>
              <Text style={s.activeLine}>
                {tx('host.user', isHindi ? 'यूज़र' : 'User')}:{' '}
                <Text style={{ color: '#fff', fontWeight: '700' }}>{activeBooking.userName || '—'}</Text>
              </Text>
              <Text style={s.activeMeta}>{activeBooking.chargingMode || '—'}  ·  ₹{activeBooking.price ?? '—'}</Text>
              <TouchableOpacity style={s.primaryBtn} onPress={() => onManageSession?.()} activeOpacity={0.85}>
                <Text style={s.primaryBtnText}>{tx('host.manageSession', isHindi ? 'सेशन मैनेज करें' : 'Manage Session')} →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Pending requests */}
          {pendingCount > 0 && (
            <View style={s.pendingCard}>
              <Text style={s.pendingText}>
                {isHindi
                  ? `${pendingCount} नया अनुरोध प्रतीक्षा में है`
                  : `${pendingCount} new request${pendingCount > 1 ? 's' : ''} waiting`}
              </Text>
              <TouchableOpacity style={s.reviewBtn} onPress={() => onReviewRequests?.()} activeOpacity={0.85}>
                <Text style={s.reviewBtnText}>{tx('host.review', isHindi ? 'रिव्यू' : 'Review')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Earnings summary */}
          <View style={s.earningsRow}>
            <TouchableOpacity style={s.earnCard} onPress={() => onOpenEarnings?.()} activeOpacity={0.85}>
              <Text style={s.earnLabel}>{tx('host.todayEarnings', isHindi ? 'आज की कमाई' : "Today's earnings")}</Text>
              <Text style={s.earnValue}>₹{earnings?.today ?? 0}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.earnCard} onPress={() => onOpenEarnings?.()} activeOpacity={0.85}>
              <Text style={s.earnLabel}>{tx('host.monthEarnings', isHindi ? 'महीने की कमाई' : "This month's earnings")}</Text>
              <Text style={s.earnValue}>₹{earnings?.month ?? 0}</Text>
            </TouchableOpacity>
          </View>

          {/* My Chargers */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{tx('host.myChargers', isHindi ? 'मेरे चार्जर' : 'My Chargers')}</Text>
              <TouchableOpacity style={s.addBtn} onPress={() => onAddCharger?.()} activeOpacity={0.8}>
                <Text style={s.addBtnPlus}>+</Text>
                <Text style={s.addBtnText}>{tx('host.add', isHindi ? 'जोड़ें' : 'Add')}</Text>
              </TouchableOpacity>
            </View>

            {chargers.length === 0 ? (
              <Text style={s.emptyText}>{tx('host.noChargers', isHindi ? 'कोई चार्जर नहीं जोड़ा गया' : 'No chargers added yet')}</Text>
            ) : (
              <View style={s.chargerList}>
                {chargers.map((ch) => (
                  <TouchableOpacity key={ch.id} style={s.chargerCard} onPress={() => onOpenCharger?.(ch)} activeOpacity={0.8}>
                    <View style={s.chargerLeft}>
                      <View style={s.chargerIcon}><Text style={{ fontSize: 15 }}>⚡</Text></View>
                      <View style={s.chargerTextWrap}>
                        <Text style={s.chargerName} numberOfLines={1}>{ch.name || tx('host.charger', 'Charger')}</Text>
                        <Text style={s.chargerMeta}>{ch.connectorType || 'AC'}  ·  {isHindi ? 'आज' : 'Today'}: {ch.todaySessions ?? 0} {isHindi ? 'सेशन' : 'sessions'}</Text>
                      </View>
                    </View>

                    <View style={[
                      s.statusBadge,
                      {
                        backgroundColor: ch.isActive ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.08)',
                      },
                    ]}>
                      <Text style={{
                        fontSize: 10,
                        fontWeight: '700',
                        color: ch.isActive ? '#22C55E' : 'rgba(255,255,255,0.6)',
                      }}>
                        {ch.isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Recent activity */}
          <View style={[s.section, { marginBottom: 20 }]}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{tx('host.recentActivity', isHindi ? 'हाल की गतिविधि' : 'Recent Activity')}</Text>
            </View>

            {recentActivity.length === 0 ? (
              <Text style={s.emptyText}>{tx('host.noActivity', isHindi ? 'अभी कोई गतिविधि नहीं' : 'No recent activity')}</Text>
            ) : (
              recentActivity.slice(0, 3).map((item, i) => (
                <ActivityRow key={item.id || i} item={item} isHindi={isHindi} />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={s.tabBar}>
        {tabs.map(({ id, label, emoji }) => {
          const active = activeTab === id;
          return (
            <TouchableOpacity key={id} style={s.tabBtn} onPress={() => onTabPress?.(id)} activeOpacity={0.75}>
              <Text style={[s.tabEmoji, { opacity: active ? 1 : 0.38 }]}>{emoji}</Text>
              <Text style={[s.tabLabel, { color: active ? '#00D4AA' : 'rgba(255,255,255,0.38)' }]}>{label}</Text>
              {active && <View style={s.tabDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function ActivityRow({ item, isHindi }) {
  const d = item.completedAt?.toDate?.() ?? (item.completedAt ? new Date(item.completedAt) : null);
  const dateStr = d ? d.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { day: '2-digit', month: 'short' }) : '—';
  return (
    <View style={s.activityRow}>
      <View style={s.activityLeft}>
        <Text style={s.activityDate}>{dateStr}</Text>
        <Text style={s.activityUser}>{item.userName || '—'}</Text>
      </View>
      <View style={s.activityRight}>
        <Text style={s.activityKwh}>{item.kwh ?? '—'} kWh</Text>
        <Text style={s.activityAmt}>₹{item.finalAmount ?? '—'}</Text>
      </View>
    </View>
  );
}

function avatarInitials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}
function hashColor(str) {
  const p = ['#7C3AED','#2563EB','#D97706','#DC2626','#059669','#DB2777','#0891B2','#65A30D'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}
function bookingStatusLabel(status, isHindi) {
  const map = {
    REQUEST: isHindi ? 'मिलान हो रहा है' : 'Matching',
    BOOKED: isHindi ? 'बुक हो गया' : 'Booked',
    CONFIRMED: isHindi ? 'कन्फर्म' : 'Confirmed',
    STARTED: isHindi ? 'चार्जिंग' : 'Charging',
    COMPLETED: isHindi ? 'पूरा' : 'Completed',
  };
  return map[status] || status;
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 80 },

  hero: {
    backgroundColor: 'rgba(0,212,170,0.07)',
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greetingCol: { flex: 1, gap: 4 },
  greetingLine: { fontSize: 20, color: 'rgba(255,255,255,0.84)', lineHeight: 26 },
  firstName: { color: '#fff', fontWeight: '700' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },

  heroRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarImg: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(0,212,170,.4)' },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,212,170,.4)',
  },
  avatarInitials: { fontSize: 14, fontWeight: '700', color: '#fff' },

  onlineToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineText: { fontSize: 12, fontWeight: '700' },

  body: { padding: 16 },

  activeCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(0,212,170,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,170,0.3)',
    borderLeftWidth: 4,
    borderLeftColor: '#00D4AA',
    marginBottom: 14,
    padding: 14,
  },
  activeBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  activeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00D4AA',
    backgroundColor: 'rgba(0,212,170,0.15)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  activePulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#00D4AA' },
  activeLine: { fontSize: 13, color: 'rgba(255,255,255,.62)', marginBottom: 4 },
  activeMeta: { fontSize: 13, color: 'rgba(255,255,255,.45)', marginBottom: 12 },
  primaryBtn: { backgroundColor: '#00D4AA', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  primaryBtnText: { color: '#0A0A0F', fontWeight: '700', fontSize: 14 },

  pendingCard: {
    marginBottom: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
    backgroundColor: 'rgba(245,158,11,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pendingText: { fontSize: 13, color: '#FCD34D', fontWeight: '600', flex: 1 },
  reviewBtn: {
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  reviewBtnText: { color: '#111827', fontWeight: '700', fontSize: 12 },

  earningsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  earnCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    gap: 6,
  },
  earnLabel: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  earnValue: { fontSize: 20, fontWeight: '700', color: '#00D4AA' },

  section: { marginBottom: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,212,170,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,170,0.22)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  addBtnPlus: { fontSize: 14, lineHeight: 14, color: '#00D4AA', fontWeight: '700' },
  addBtnText: { fontSize: 13, color: '#00D4AA', fontWeight: '700' },

  chargerList: { gap: 10 },
  chargerCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  chargerLeft: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  chargerIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: 'rgba(0,212,170,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chargerTextWrap: { flex: 1 },
  chargerName: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 3 },
  chargerMeta: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },

  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', paddingVertical: 12 },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  activityLeft: { flex: 1, gap: 2 },
  activityDate: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  activityUser: { fontSize: 13, fontWeight: '500', color: '#fff' },
  activityRight: { alignItems: 'flex-end', gap: 2 },
  activityKwh: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  activityAmt: { fontSize: 13, fontWeight: '600', color: '#00D4AA' },

  tabBar: {
    height: 64,
    backgroundColor: 'rgba(10,10,15,.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,.07)',
    flexDirection: 'row',
  },
  tabBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative' },
  tabEmoji: { fontSize: 20 },
  tabLabel: { fontSize: 10, fontWeight: '500' },
  tabDot: { position: 'absolute', bottom: 8, width: 4, height: 4, borderRadius: 2, backgroundColor: '#00D4AA' },
});
