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

const MAX_TABS = 4;

/**
 * Screen 06 — Home Screen (User, React Native)
 * Same props as HomeScreen.jsx
 */
export default function HomeScreen({
  user = {},
  stats = null,
  activeBooking = null,
  nearbyChargers = [],
  recentSessions = [],
  unreadCount = 0,
  activeTab = 'home',
  onSearch,
  onMapPress,
  onChargerPress,
  onContinueSession,
  onSeeAllChargers,
  onNotificationPress,
  onProfilePress,
  onTabPress,
}) {
  const { t, locale } = useI18n();
  const isHindi = locale === 'hi';
  const [pulseAnim] = useState(() => new Animated.Value(1));

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  const firstName = (user?.displayName ?? '').split(' ')[0] || tx('home.user', 'User');
  const initials = avatarInitials(user?.displayName);
  const avatarBg = hashColor(user?.displayName || 'user');

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

  // Pulse animation for active booking dot
  React.useEffect(() => {
    if (!activeBooking) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [activeBooking, pulseAnim]);

  const TABS = [
    { id: 'home', label: isHindi ? 'होम' : 'Home', emoji: '🏠' },
    { id: 'map', label: isHindi ? 'मैप' : 'Map', emoji: '📍' },
    { id: 'sessions', label: isHindi ? 'सेशन' : 'Sessions', emoji: '⚡' },
    { id: 'profile', label: isHindi ? 'प्रोफाइल' : 'Profile', emoji: '👤' },
  ];

  const hasStats = stats && (stats.sessions > 0 || stats.kwh > 0 || stats.spent > 0);

  return (
    <View style={s.page}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── HERO ── */}
        <View style={s.hero}>
          <View style={s.heroTopRow}>
            <View style={s.greetingCol}>
              <Text style={s.greetingLine}>
                {greeting} <Text style={s.firstName}>{firstName}</Text>
              </Text>
              <Text style={s.heroSub}>
                {tx('home.findCharger', isHindi ? 'पास में चार्जर खोजें' : 'Find a charger near you')}
              </Text>
            </View>
            <View style={s.heroRight}>
              <TouchableOpacity style={s.bellBtn} onPress={() => onNotificationPress?.()} activeOpacity={0.7}>
                <Text style={s.bellEmoji}>🔔</Text>
                {unreadCount > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onProfilePress?.()} activeOpacity={0.85}>
                {user?.photoURL
                  ? <Image source={{ uri: user.photoURL }} style={s.avatarImg} />
                  : <View style={[s.avatarCircle, { backgroundColor: avatarBg }]}>
                      <Text style={s.avatarInitialsText}>{initials}</Text>
                    </View>}
              </TouchableOpacity>
            </View>
          </View>

          {/* Search bar */}
          <TouchableOpacity style={s.searchBar} onPress={() => onSearch?.()} activeOpacity={0.8}>
            <Text style={s.searchIcon}>🔍</Text>
            <Text style={s.searchPlaceholder}>
              {tx('home.searchPlaceholder', isHindi ? 'स्थान या चार्जर खोजें...' : 'Search location or charger...')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={s.body}>

          {/* ── ACTIVE BOOKING ── */}
          {activeBooking && (
            <View style={s.activeCard}>
              <View style={s.activeBadgeRow}>
                <Text style={s.activeBadge}>{bookingBadgeLabel(activeBooking.status, isHindi)}</Text>
                <Animated.View style={[s.activePulse, { opacity: pulseAnim }]} />
              </View>
              <Text style={s.activeHost}>
                {tx('home.host', isHindi ? 'होस्ट' : 'Host')}:{' '}
                <Text style={{ color: '#fff', fontWeight: '700' }}>{activeBooking.hostName || '—'}</Text>
              </Text>
              <Text style={s.activeDetail}>
                {activeBooking.chargingMode || '—'}  ·  ₹{activeBooking.price ?? '—'}
              </Text>
              <TouchableOpacity style={s.continueBtn} onPress={() => onContinueSession?.()} activeOpacity={0.85}>
                <Text style={s.continueBtnText}>
                  {tx('home.continueSession', isHindi ? 'सेशन जारी रखें' : 'Continue Session')} →
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── STATS ── */}
          {hasStats && (
            <View style={s.statsRow}>
              <StatCard icon="⚡" value={String(stats.sessions)} label={tx('home.statSessions', isHindi ? 'सेशन' : 'Sessions')} />
              <StatCard icon="🔋" value={`${stats.kwh}`} label="kWh" />
              <StatCard icon="₹" value={`₹${stats.spent}`} label={tx('home.statSpent', isHindi ? 'खर्च' : 'Spent')} />
            </View>
          )}

          {/* ── MAP PREVIEW ── */}
          <TouchableOpacity style={s.mapCard} onPress={() => onMapPress?.()} activeOpacity={0.9}>
            <MapPreview pins={nearbyChargers} />
            <View style={s.mapOverlay}>
              <View style={s.mapBtn}>
                <Text style={s.mapBtnText}>
                  {tx('home.viewChargers', isHindi
                    ? `${nearbyChargers.length} चार्जर पास में देखें`
                    : `View all ${nearbyChargers.length} chargers nearby`)}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* ── NEARBY CHARGERS ── */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>
                {tx('home.nearbyChargers', isHindi ? 'पास के चार्जर' : 'Nearby Chargers')}
              </Text>
              <TouchableOpacity onPress={() => onSeeAllChargers?.()}>
                <Text style={s.seeAll}>{tx('home.seeAll', isHindi ? 'सब देखें' : 'See all')}</Text>
              </TouchableOpacity>
            </View>
            {nearbyChargers.length === 0 ? (
              <Text style={s.emptyText}>
                {tx('home.noChargers', isHindi ? 'पास में कोई चार्जर नहीं मिला' : 'No chargers found nearby')}
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.hScroll}>
                {nearbyChargers.map((c) => (
                  <ChargerCard key={c.id} charger={c} onPress={() => onChargerPress?.(c)} isHindi={isHindi} tx={tx} />
                ))}
              </ScrollView>
            )}
          </View>

          {/* ── RECENT SESSIONS ── */}
          {recentSessions.length > 0 && (
            <View style={[s.section, { marginBottom: 20 }]}>
              <View style={s.sectionHeader}>
                <Text style={s.sectionTitle}>
                  {tx('home.recentSessions', isHindi ? 'हाल के सेशन' : 'Recent Sessions')}
                </Text>
              </View>
              {recentSessions.slice(0, 3).map((sess, i) => (
                <SessionRow key={sess.id || i} session={sess} isHindi={isHindi} tx={tx} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── BOTTOM TAB BAR ── */}
      <View style={s.tabBar}>
        {TABS.map(({ id, label, emoji }) => {
          const active = activeTab === id;
          return (
            <TouchableOpacity
              key={id}
              style={s.tabBtn}
              onPress={() => onTabPress?.(id)}
              activeOpacity={0.7}
            >
              <Text style={[s.tabEmoji, { opacity: active ? 1 : 0.38 }]}>{emoji}</Text>
              <Text style={[s.tabLabel, { color: active ? '#00D4AA' : 'rgba(255,255,255,0.38)' }]}>
                {label}
              </Text>
              {active && <View style={s.tabDot} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ icon, value, label }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function MapPreview({ pins = [] }) {
  return (
    <View style={s.mapPreview}>
      {pins.slice(0, 6).map((p, i) => (
        <View
          key={p.id || i}
          style={[
            s.mapPin,
            {
              left: `${15 + ((i * 37) % 70)}%`,
              top: `${20 + ((i * 29) % 55)}%`,
              backgroundColor: p.available !== false ? '#00D4AA' : 'rgba(255,255,255,0.3)',
            },
          ]}
        />
      ))}
      <View style={s.userDot} />
    </View>
  );
}

function ChargerCard({ charger, onPress, tx }) {
  const stars = Math.round(charger.rating ?? 0);
  return (
    <TouchableOpacity style={s.chargerCard} onPress={onPress} activeOpacity={0.8}>
      <View style={s.chargerIllo}>
        <Text style={{ fontSize: 28 }}>⚡</Text>
        {charger.available !== false && <View style={s.availDot} />}
      </View>
      <View style={s.chargerInfo}>
        <Text style={s.chargerHost} numberOfLines={1}>{charger.hostName || tx('home.host', 'Host')}</Text>
        <View style={s.starsRow}>
          {[1,2,3,4,5].map((n) => (
            <Text key={n} style={{ color: n <= stars ? '#FACC15' : 'rgba(255,255,255,0.2)', fontSize: 10 }}>★</Text>
          ))}
        </View>
        <Text style={s.chargerMeta}>
          {charger.distance ? `${charger.distance} km` : '—'}  ·  ₹{charger.pricePerKwh ?? '—'}/kWh
        </Text>
        <View style={s.connBadge}>
          <Text style={s.connBadgeText}>{charger.connectorType || 'AC'}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function SessionRow({ session, isHindi }) {
  const date = session.completedAt?.toDate?.() ?? (session.completedAt ? new Date(session.completedAt) : null);
  const dateStr = date
    ? date.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { day: '2-digit', month: 'short' })
    : '—';
  return (
    <View style={s.sessionRow}>
      <View style={s.sessionLeft}>
        <Text style={s.sessionDate}>{dateStr}</Text>
        <Text style={s.sessionHost}>{session.hostName || '—'}</Text>
      </View>
      <View style={s.sessionRight}>
        <Text style={s.sessionKwh}>{session.kwh ?? '—'} kWh</Text>
        <Text style={s.sessionAmt}>₹{session.finalAmount ?? '—'}</Text>
      </View>
      {session.rating ? <Text style={s.sessionRating}>{'★'.repeat(session.rating)}</Text> : null}
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
function avatarInitials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}
function hashColor(str) {
  const p = ['#7C3AED','#2563EB','#D97706','#DC2626','#059669','#DB2777','#0891B2','#65A30D'];
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return p[Math.abs(h) % p.length];
}
function bookingBadgeLabel(status, isHindi) {
  const map = {
    REQUEST:   isHindi ? 'मिलान हो रहा है' : 'Matching',
    BOOKED:    isHindi ? 'बुक हो गया' : 'Booked',
    CONFIRMED: isHindi ? 'कन्फर्म हो गया' : 'Confirmed',
    STARTED:   isHindi ? 'चार्जिंग जारी' : 'Charging',
    COMPLETED: isHindi ? 'पूरा हुआ' : 'Completed',
  };
  return map[status] || status;
}

// ── Styles ────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0A0A0F' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 80 },

  // Hero
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
    marginBottom: 16,
  },
  greetingCol: { flex: 1, gap: 4 },
  greetingLine: { fontSize: 20, fontWeight: '400', color: 'rgba(255,255,255,0.8)', lineHeight: 26 },
  firstName: { fontWeight: '700', color: '#FFFFFF' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  heroRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bellBtn: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  bellEmoji: { fontSize: 17 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#FF4D6A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#0A0A0F',
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#fff' },
  avatarImg: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(0,212,170,0.4)' },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,212,170,0.4)',
  },
  avatarInitialsText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
  },
  searchIcon: { fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  searchPlaceholder: { fontSize: 14, color: 'rgba(255,255,255,0.35)' },

  body: { padding: 16 },

  // Active booking
  activeCard: {
    borderRadius: 16,
    backgroundColor: 'rgba(0,212,170,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,170,0.3)',
    borderLeftWidth: 4,
    borderLeftColor: '#00D4AA',
    marginBottom: 16,
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
  activeHost: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 3 },
  activeDetail: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 12 },
  continueBtn: {
    backgroundColor: '#00D4AA',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  continueBtnText: { color: '#0A0A0F', fontWeight: '700', fontSize: 14 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 4,
  },
  statIcon: { fontSize: 18 },
  statValue: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },

  // Map
  mapCard: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  mapPreview: { flex: 1, backgroundColor: '#111827', position: 'relative' },
  mapPin: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#0A0A0F',
  },
  userDot: {
    position: 'absolute',
    bottom: '42%',
    left: '48%',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#7C3AED',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  mapOverlay: { position: 'absolute', bottom: 12, left: 0, right: 0, alignItems: 'center' },
  mapBtn: {
    backgroundColor: '#00D4AA',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  mapBtnText: { color: '#0A0A0F', fontWeight: '700', fontSize: 13 },

  // Sections
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  seeAll: { fontSize: 13, color: '#00D4AA', fontWeight: '500' },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', paddingVertical: 16 },
  hScroll: { marginHorizontal: -2 },

  // Charger card
  chargerCard: {
    width: 156,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    marginHorizontal: 2,
    marginBottom: 4,
  },
  chargerIllo: {
    height: 88,
    backgroundColor: 'rgba(0,212,170,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  availDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#0A0A0F',
  },
  chargerInfo: { padding: 10, paddingBottom: 12 },
  chargerHost: { fontSize: 13, fontWeight: '600', color: '#FFFFFF', marginBottom: 3 },
  starsRow: { flexDirection: 'row', gap: 1, marginBottom: 4 },
  chargerMeta: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 6 },
  connBadge: {
    backgroundColor: 'rgba(0,212,170,0.12)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  connBadgeText: { fontSize: 10, fontWeight: '600', color: '#00D4AA' },

  // Session rows
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  sessionLeft: { flex: 1, gap: 2 },
  sessionDate: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  sessionHost: { fontSize: 13, fontWeight: '500', color: '#FFFFFF' },
  sessionRight: { alignItems: 'flex-end', gap: 2 },
  sessionKwh: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  sessionAmt: { fontSize: 13, fontWeight: '600', color: '#00D4AA' },
  sessionRating: { fontSize: 12, color: '#FACC15', marginLeft: 4 },

  // Tab bar
  tabBar: {
    height: 64,
    backgroundColor: 'rgba(10,10,15,0.97)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    position: 'relative',
  },
  tabEmoji: { fontSize: 20 },
  tabLabel: { fontSize: 10, fontWeight: '500' },
  tabDot: {
    position: 'absolute',
    bottom: 8,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00D4AA',
  },
});
