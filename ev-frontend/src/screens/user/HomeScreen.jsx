import React, { useMemo } from 'react';
import { useI18n } from '../../i18n';

/**
 * Screen 06 — Home Screen (User, Web)
 *
 * Props:
 *   user               — { displayName, photoURL }
 *   stats              — { sessions: number, kwh: number, spent: number } | null
 *   activeBooking      — Firestore booking doc | null  (parent resolves routing)
 *   nearbyChargers     — ChargerDoc[]
 *   recentSessions     — SessionDoc[]
 *   unreadCount        — number
 *   activeTab          — 'home' | 'map' | 'sessions' | 'profile'
 *   onSearch()
 *   onMapPress()
 *   onChargerPress(charger)
 *   onContinueSession()
 *   onSeeAllChargers()
 *   onNotificationPress()
 *   onProfilePress()
 *   onTabPress(tab)
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

  const bookingStatusLabel = activeBooking
    ? bookingBadgeLabel(activeBooking.status, isHindi)
    : '';

  const TABS = [
    { id: 'home', label: isHindi ? 'होम' : 'Home', icon: HomeIcon },
    { id: 'map', label: isHindi ? 'मैप' : 'Map', icon: MapIcon },
    { id: 'sessions', label: isHindi ? 'सेशन' : 'Sessions', icon: BoltIcon },
    { id: 'profile', label: isHindi ? 'प्रोफाइल' : 'Profile', icon: PersonIcon },
  ];

  return (
    <div style={s.page}>
      <style>{cssText}</style>

      {/* ── Scrollable content ── */}
      <div style={s.scroll}>

        {/* HERO SECTION */}
        <div style={s.hero}>
          {/* Top row: greeting + avatar + bell */}
          <div style={s.heroTopRow}>
            <div style={s.greetingCol}>
              <span style={s.greetingLine}>
                {greeting} <strong style={s.firstName}>{firstName}</strong>
              </span>
              <span style={s.heroSub}>
                {tx('home.findCharger', isHindi ? 'पास में चार्जर खोजें' : 'Find a charger near you')}
              </span>
            </div>
            <div style={s.heroRight}>
              <button style={s.bellBtn} onClick={() => onNotificationPress?.()} aria-label="Notifications">
                <BellIcon />
                {unreadCount > 0 && (
                  <span style={s.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
                )}
              </button>
              <button style={s.avatarBtn} onClick={() => onProfilePress?.()} aria-label="Profile">
                {user?.photoURL
                  ? <img src={user.photoURL} alt="" style={s.avatarImg} referrerPolicy="no-referrer" />
                  : <div style={{ ...s.avatarCircle, background: avatarBg }}>{initials}</div>}
              </button>
            </div>
          </div>

          {/* Search bar */}
          <button style={s.searchBar} onClick={() => onSearch?.()} aria-label="Search charger">
            <SearchIcon />
            <span style={s.searchPlaceholder}>
              {tx('home.searchPlaceholder', isHindi ? 'स्थान या चार्जर खोजें...' : 'Search location or charger...')}
            </span>
          </button>
        </div>

        <div style={s.body}>

          {/* ── ACTIVE BOOKING CARD (top priority) ── */}
          {activeBooking && (
            <div style={s.activeCard}>
              <div style={s.activeCardInner}>
                <div style={s.activeBadgeRow}>
                  <span style={s.activeBadge}>{bookingStatusLabel}</span>
                  <span style={s.activePulse} />
                </div>
                <p style={s.activeHost}>
                  {tx('home.host', isHindi ? 'होस्ट' : 'Host')}:{' '}
                  <strong style={{ color: '#fff' }}>{activeBooking.hostName || '—'}</strong>
                </p>
                <p style={s.activeDetail}>
                  {activeBooking.chargingMode || '—'} &nbsp;·&nbsp; ₹{activeBooking.price ?? '—'}
                </p>
                <button style={s.continueBtn} onClick={() => onContinueSession?.()}>
                  {tx('home.continueSession', isHindi ? 'सेशन जारी रखें' : 'Continue Session')} →
                </button>
              </div>
            </div>
          )}

          {/* ── QUICK STATS ── */}
          {stats && (stats.sessions > 0 || stats.kwh > 0 || stats.spent > 0) && (
            <div style={s.statsRow}>
              <StatCard icon="⚡" value={stats.sessions} label={tx('home.statSessions', isHindi ? 'सेशन' : 'Sessions')} />
              <StatCard icon="🔋" value={`${stats.kwh}`} label="kWh" />
              <StatCard icon="₹" value={`₹${stats.spent}`} label={tx('home.statSpent', isHindi ? 'खर्च' : 'Spent')} />
            </div>
          )}

          {/* ── MAP PREVIEW ── */}
          <button style={s.mapCard} onClick={() => onMapPress?.()} aria-label="View map">
            <MapPreview pins={nearbyChargers} />
            <div style={s.mapOverlay}>
              <span style={s.mapBtn}>
                {tx('home.viewChargers', isHindi
                  ? `${nearbyChargers.length} चार्जर पास में देखें`
                  : `View all ${nearbyChargers.length} chargers nearby`)}
              </span>
            </div>
          </button>

          {/* ── NEARBY CHARGERS ── */}
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionTitle}>
                {tx('home.nearbyChargers', isHindi ? 'पास के चार्जर' : 'Nearby Chargers')}
              </span>
              <button style={s.seeAll} onClick={() => onSeeAllChargers?.()}>
                {tx('home.seeAll', isHindi ? 'सब देखें' : 'See all')}
              </button>
            </div>
            {nearbyChargers.length === 0 ? (
              <p style={s.emptyText}>
                {tx('home.noChargers', isHindi ? 'पास में कोई चार्जर नहीं मिला' : 'No chargers found nearby')}
              </p>
            ) : (
              <div style={s.hScroll}>
                {nearbyChargers.map((c) => (
                  <ChargerCard key={c.id} charger={c} onPress={() => onChargerPress?.(c)} isHindi={isHindi} tx={tx} />
                ))}
              </div>
            )}
          </div>

          {/* ── RECENT SESSIONS ── */}
          {recentSessions.length > 0 && (
            <div style={{ ...s.section, marginBottom: 100 }}>
              <div style={s.sectionHeader}>
                <span style={s.sectionTitle}>
                  {tx('home.recentSessions', isHindi ? 'हाल के सेशन' : 'Recent Sessions')}
                </span>
              </div>
              {recentSessions.slice(0, 3).map((sess, i) => (
                <SessionRow key={sess.id || i} session={sess} isHindi={isHindi} tx={tx} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── BOTTOM TAB BAR ── */}
      <nav style={s.tabBar} aria-label="Main navigation">
        {TABS.map(({ id, label, icon }) => {
          const Icon = icon;
          const active = activeTab === id;
          return (
            <button
              key={id}
              style={s.tabBtn}
              onClick={() => onTabPress?.(id)}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
            >
              <Icon color={active ? '#00D4AA' : 'rgba(255,255,255,0.38)'} />
              <span style={{ ...s.tabLabel, color: active ? '#00D4AA' : 'rgba(255,255,255,0.38)' }}>
                {label}
              </span>
              {active && <span style={s.tabDot} />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ icon, value, label }) {
  return (
    <div style={s.statCard}>
      <span style={s.statIcon}>{icon}</span>
      <span style={s.statValue}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  );
}

function MapPreview({ pins = [] }) {
  return (
    <div style={s.mapPreview} aria-hidden="true">
      {/* Grid lines */}
      {[20, 40, 60, 80].map((y) => (
        <div key={y} style={{ ...s.mapLine, top: `${y}%` }} />
      ))}
      {[25, 50, 75].map((x) => (
        <div key={x} style={{ ...s.mapLineV, left: `${x}%` }} />
      ))}
      {/* Charger pins */}
      {pins.slice(0, 6).map((p, i) => (
        <div
          key={p.id || i}
          style={{
            ...s.mapPin,
            left: `${15 + ((i * 37) % 70)}%`,
            top: `${20 + ((i * 29) % 55)}%`,
            background: p.available !== false ? '#00D4AA' : 'rgba(255,255,255,0.3)',
          }}
        />
      ))}
      {/* User dot */}
      <div style={s.userDot} />
    </div>
  );
}

function ChargerCard({ charger, onPress, tx }) {
  const stars = Math.round(charger.rating ?? 0);
  return (
    <button style={s.chargerCard} onClick={onPress}>
      {/* Illustration placeholder */}
      <div style={s.chargerIllo}>
        <span style={{ fontSize: 28 }}>⚡</span>
        {charger.available !== false && <span style={s.availDot} />}
      </div>
      <div style={s.chargerInfo}>
        <p style={s.chargerHost}>{charger.hostName || tx('home.host', 'Host')}</p>
        <div style={s.starsRow}>{[1,2,3,4,5].map((n) => (
          <span key={n} style={{ color: n <= stars ? '#FACC15' : 'rgba(255,255,255,0.2)', fontSize: 10 }}>★</span>
        ))}</div>
        <p style={s.chargerMeta}>
          {charger.distance ? `${charger.distance} km` : '—'} &nbsp;·&nbsp; ₹{charger.pricePerKwh ?? '—'}/kWh
        </p>
        <span style={s.connBadge}>{charger.connectorType || 'AC'}</span>
      </div>
    </button>
  );
}

function SessionRow({ session, isHindi }) {
  const date = session.completedAt?.toDate?.() ?? (session.completedAt ? new Date(session.completedAt) : null);
  const dateStr = date ? date.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { day: '2-digit', month: 'short' }) : '—';
  return (
    <div style={s.sessionRow}>
      <div style={s.sessionLeft}>
        <span style={s.sessionDate}>{dateStr}</span>
        <span style={s.sessionHost}>{session.hostName || '—'}</span>
      </div>
      <div style={s.sessionRight}>
        <span style={s.sessionKwh}>{session.kwh ?? '—'} kWh</span>
        <span style={s.sessionAmt}>₹{session.finalAmount ?? '—'}</span>
      </div>
      {session.rating && (
        <span style={s.sessionRating}>{'★'.repeat(session.rating)}</span>
      )}
    </div>
  );
}

// ── Icons (inline SVG) ─────────────────────────────────────────────────────
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="11" cy="11" r="7" stroke="rgba(255,255,255,0.4)" strokeWidth="2" />
      <path d="M16.5 16.5L21 21" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function HomeIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 22V12h6v10" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function MapIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="10" r="3" stroke={color} strokeWidth="1.8" />
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}
function BoltIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M13 2L4.09 12.96H11L10.45 22 20 11.04H13.5L13 2z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function PersonIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.8" />
      <path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
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

// ── CSS ────────────────────────────────────────────────────────────────────
const cssText = `
  * { box-sizing: border-box; }
  button { cursor: pointer; border: none; background: none; padding: 0; font-family: 'Inter', sans-serif; }
  ::-webkit-scrollbar { display: none; }
  @keyframes pulseDot {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.4; transform: scale(0.7); }
  }
`;

// ── Styles ─────────────────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: '100dvh',
    background: '#0A0A0F',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', sans-serif",
    color: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingBottom: 80,
  },

  // Hero
  hero: {
    background: 'linear-gradient(180deg, rgba(0,212,170,0.10) 0%, transparent 100%)',
    padding: '52px 20px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  heroTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greetingCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  greetingLine: {
    fontSize: 20,
    fontWeight: 400,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 1.3,
  },
  firstName: { color: '#FFFFFF', fontWeight: 700 },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
  },
  heroRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  bellBtn: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.07)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    background: '#FF4D6A',
    color: '#fff',
    fontSize: 9,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 3px',
    border: '1.5px solid #0A0A0F',
  },
  avatarBtn: {
    borderRadius: '50%',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid rgba(0,212,170,0.4)',
    display: 'block',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    color: '#fff',
    border: '2px solid rgba(0,212,170,0.4)',
  },
  searchBar: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 14,
    textAlign: 'left',
  },
  searchPlaceholder: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
  },

  body: { padding: '16px 16px 0' },

  // Active booking
  activeCard: {
    borderRadius: 16,
    background: 'rgba(0,212,170,0.07)',
    border: '1px solid rgba(0,212,170,0.3)',
    borderLeft: '4px solid #00D4AA',
    marginBottom: 16,
    overflow: 'hidden',
  },
  activeCardInner: { padding: '14px 16px' },
  activeBadgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  activeBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: '#00D4AA',
    background: 'rgba(0,212,170,0.15)',
    borderRadius: 6,
    padding: '3px 8px',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },
  activePulse: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#00D4AA',
    animation: 'pulseDot 1.4s ease-in-out infinite',
  },
  activeHost: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    margin: '0 0 3px',
  },
  activeDetail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    margin: '0 0 12px',
  },
  continueBtn: {
    width: '100%',
    padding: '11px',
    background: '#00D4AA',
    color: '#0A0A0F',
    fontWeight: 700,
    fontSize: 14,
    borderRadius: 10,
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
  },

  // Stats
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '14px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  },
  statIcon: { fontSize: 18 },
  statValue: { fontSize: 16, fontWeight: 700, color: '#FFFFFF' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },

  // Map card
  mapCard: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 20,
    border: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer',
    display: 'block',
  },
  mapPreview: {
    width: '100%',
    height: '100%',
    background: '#111827',
    position: 'relative',
    overflow: 'hidden',
  },
  mapLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    background: 'rgba(255,255,255,0.05)',
  },
  mapLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    background: 'rgba(255,255,255,0.05)',
  },
  mapPin: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: '50%',
    border: '2px solid #0A0A0F',
  },
  userDot: {
    position: 'absolute',
    bottom: '42%',
    left: '48%',
    width: 14,
    height: 14,
    borderRadius: '50%',
    background: '#7C3AED',
    border: '2.5px solid #fff',
    boxShadow: '0 0 0 4px rgba(124,58,237,0.3)',
  },
  mapOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
  },
  mapBtn: {
    background: '#00D4AA',
    color: '#0A0A0F',
    fontWeight: 700,
    fontSize: 13,
    borderRadius: 20,
    padding: '8px 18px',
    boxShadow: '0 2px 12px rgba(0,212,170,0.35)',
  },

  // Sections
  section: { marginBottom: 20 },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#FFFFFF' },
  seeAll: {
    fontSize: 13,
    color: '#00D4AA',
    fontWeight: 500,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'Inter', sans-serif",
  },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '16px 0', margin: 0 },

  // Horizontal scroll
  hScroll: {
    display: 'flex',
    gap: 12,
    overflowX: 'auto',
    paddingBottom: 4,
    scrollbarWidth: 'none',
  },

  // Charger card
  chargerCard: {
    flexShrink: 0,
    width: 156,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.09)',
    overflow: 'hidden',
    cursor: 'pointer',
    display: 'block',
    textAlign: 'left',
  },
  chargerIllo: {
    height: 88,
    background: 'linear-gradient(135deg, rgba(0,212,170,0.12) 0%, rgba(124,58,237,0.12) 100%)',
    display: 'flex',
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
    borderRadius: '50%',
    background: '#22C55E',
    border: '1.5px solid #0A0A0F',
  },
  chargerInfo: { padding: '10px 10px 12px' },
  chargerHost: { fontSize: 13, fontWeight: 600, color: '#FFFFFF', margin: '0 0 3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  starsRow: { display: 'flex', gap: 1, marginBottom: 4 },
  chargerMeta: { fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: '0 0 6px' },
  connBadge: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 600,
    color: '#00D4AA',
    background: 'rgba(0,212,170,0.12)',
    borderRadius: 4,
    padding: '2px 6px',
  },

  // Session rows
  sessionRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '11px 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    gap: 8,
  },
  sessionLeft: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  sessionDate: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  sessionHost: { fontSize: 13, fontWeight: 500, color: '#FFFFFF' },
  sessionRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 },
  sessionKwh: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  sessionAmt: { fontSize: 13, fontWeight: 600, color: '#00D4AA' },
  sessionRating: { fontSize: 12, color: '#FACC15', marginLeft: 4 },

  // Tab bar
  tabBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    background: 'rgba(10,10,15,0.95)',
    backdropFilter: 'blur(16px)',
    borderTop: '1px solid rgba(255,255,255,0.07)',
    display: 'flex',
    zIndex: 100,
  },
  tabBtn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    position: 'relative',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
  },
  tabLabel: { fontSize: 10, fontWeight: 500 },
  tabDot: {
    position: 'absolute',
    bottom: 8,
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: '#00D4AA',
  },
};
