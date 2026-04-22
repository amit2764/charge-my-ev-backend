import React, { useMemo } from 'react';
import { useI18n } from '../../i18n';

/**
 * Screen 07 — Home Screen (Host, Web)
 *
 * Props:
 *   host              — { displayName, photoURL }
 *   isOnline          — boolean
 *   activeBooking     — active booking/session object | null
 *   pendingRequests   — array
 *   earnings          — { today: number, month: number }
 *   chargers          — array
 *   recentActivity    — array
 *   activeTab         — 'home' | 'requests' | 'earnings' | 'profile'
 *   onToggleOnline(nextOnline)
 *   onProfilePress()
 *   onManageSession()
 *   onReviewRequests()
 *   onOpenEarnings()
 *   onAddCharger()
 *   onOpenCharger(charger)
 *   onTabPress(tab)
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

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  const firstName = (host?.displayName ?? '').split(' ')[0] || tx('home.host', 'Host');
  const initials = avatarInitials(host?.displayName);
  const avatarBg = hashColor(host?.displayName || 'host');

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

  const pendingCount = pendingRequests?.length ?? 0;

  const tabs = [
    { id: 'home', label: isHindi ? 'होम' : 'Home', icon: HomeIcon },
    { id: 'requests', label: isHindi ? 'अनुरोध' : 'Requests', icon: RequestIcon },
    { id: 'earnings', label: isHindi ? 'कमाई' : 'Earnings', icon: EarningsIcon },
    { id: 'profile', label: isHindi ? 'प्रोफाइल' : 'Profile', icon: PersonIcon },
  ];

  return (
    <div style={s.page}>
      <style>{cssText}</style>

      <div style={s.scroll}>
        {/* Top section */}
        <div style={s.hero}>
          <div style={s.heroTopRow}>
            <div style={s.greetingCol}>
              <span style={s.greetingLine}>
                {greeting} <strong style={s.firstName}>{firstName}</strong>
              </span>
              <span style={s.heroSub}>
                {tx('host.homeSub', isHindi ? 'अपना चार्जिंग नेटवर्क मैनेज करें' : 'Manage your charging network')}
              </span>
            </div>

            <div style={s.heroRight}>
              <button style={s.avatarBtn} onClick={() => onProfilePress?.()} aria-label="Profile">
                {host?.photoURL
                  ? <img src={host.photoURL} alt="" style={s.avatarImg} referrerPolicy="no-referrer" />
                  : <div style={{ ...s.avatarCircle, background: avatarBg }}>{initials}</div>}
              </button>

              <button style={s.onlineToggle} onClick={() => onToggleOnline?.(!isOnline)} aria-label="Toggle online">
                <span style={{ ...s.onlineDot, background: isOnline ? '#22C55E' : 'rgba(255,255,255,0.35)' }} />
                <span style={{ ...s.onlineText, color: isOnline ? '#22C55E' : 'rgba(255,255,255,0.6)' }}>
                  {isOnline
                    ? tx('host.online', isHindi ? 'Online' : 'Online')
                    : tx('host.offline', isHindi ? 'Offline' : 'Offline')}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div style={s.body}>
          {/* Active session — always first */}
          {activeBooking && (
            <div style={s.activeCard}>
              <div style={s.activeCardInner}>
                <div style={s.activeBadgeRow}>
                  <span style={s.activeBadge}>{bookingStatusLabel(activeBooking.status, isHindi)}</span>
                  <span style={s.activePulse} />
                </div>
                <p style={s.activeLine}>
                  {tx('host.user', isHindi ? 'यूज़र' : 'User')}: <strong style={{ color: '#fff' }}>{activeBooking.userName || '—'}</strong>
                </p>
                <p style={s.activeMeta}>
                  {activeBooking.chargingMode || '—'} · ₹{activeBooking.price ?? '—'}
                </p>
                <button style={s.primaryBtn} onClick={() => onManageSession?.()}>
                  {tx('host.manageSession', isHindi ? 'सेशन मैनेज करें' : 'Manage Session')} →
                </button>
              </div>
            </div>
          )}

          {/* Pending requests alert */}
          {pendingCount > 0 && (
            <div style={s.pendingCard}>
              <div>
                <p style={s.pendingText}>
                  {isHindi
                    ? `${pendingCount} नया अनुरोध प्रतीक्षा में है`
                    : `${pendingCount} new request${pendingCount > 1 ? 's' : ''} waiting`}
                </p>
              </div>
              <button style={s.reviewBtn} onClick={() => onReviewRequests?.()}>
                {tx('host.review', isHindi ? 'रिव्यू' : 'Review')}
              </button>
            </div>
          )}

          {/* Earnings summary */}
          <div style={s.earningsRow}>
            <button style={s.earnCard} onClick={() => onOpenEarnings?.()}>
              <span style={s.earnLabel}>{tx('host.todayEarnings', isHindi ? 'आज की कमाई' : "Today's earnings")}</span>
              <span style={s.earnValue}>₹{earnings?.today ?? 0}</span>
            </button>
            <button style={s.earnCard} onClick={() => onOpenEarnings?.()}>
              <span style={s.earnLabel}>{tx('host.monthEarnings', isHindi ? 'महीने की कमाई' : "This month's earnings")}</span>
              <span style={s.earnValue}>₹{earnings?.month ?? 0}</span>
            </button>
          </div>

          {/* My Chargers */}
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <span style={s.sectionTitle}>{tx('host.myChargers', isHindi ? 'मेरे चार्जर' : 'My Chargers')}</span>
              <button style={s.addBtn} onClick={() => onAddCharger?.()}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
                {tx('host.add', isHindi ? 'जोड़ें' : 'Add')}
              </button>
            </div>

            {chargers.length === 0 ? (
              <p style={s.emptyText}>{tx('host.noChargers', isHindi ? 'कोई चार्जर नहीं जोड़ा गया' : 'No chargers added yet')}</p>
            ) : (
              <div style={s.chargerList}>
                {chargers.map((ch) => (
                  <button key={ch.id} style={s.chargerCard} onClick={() => onOpenCharger?.(ch)}>
                    <div style={s.chargerLeft}>
                      <div style={s.chargerIcon}>⚡</div>
                      <div style={s.chargerTextWrap}>
                        <p style={s.chargerName}>{ch.name || tx('host.charger', 'Charger')}</p>
                        <p style={s.chargerMeta}>{ch.connectorType || 'AC'} · {isHindi ? 'आज' : 'Today'}: {ch.todaySessions ?? 0} {isHindi ? 'सेशन' : 'sessions'}</p>
                      </div>
                    </div>
                    <span style={{
                      ...s.statusBadge,
                      color: ch.isActive ? '#22C55E' : 'rgba(255,255,255,0.6)',
                      background: ch.isActive ? 'rgba(34,197,94,0.14)' : 'rgba(255,255,255,0.08)',
                    }}>
                      {ch.isActive
                        ? (isHindi ? 'Active' : 'Active')
                        : (isHindi ? 'Inactive' : 'Inactive')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div style={{ ...s.section, marginBottom: 100 }}>
            <div style={s.sectionHeader}>
              <span style={s.sectionTitle}>{tx('host.recentActivity', isHindi ? 'हाल की गतिविधि' : 'Recent Activity')}</span>
            </div>

            {recentActivity.length === 0 ? (
              <p style={s.emptyText}>{tx('host.noActivity', isHindi ? 'अभी कोई गतिविधि नहीं' : 'No recent activity')}</p>
            ) : (
              recentActivity.slice(0, 3).map((item, i) => (
                <ActivityRow key={item.id || i} item={item} isHindi={isHindi} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom tabs */}
      <nav style={s.tabBar} aria-label="Host navigation">
        {tabs.map(({ id, label, icon }) => {
          const Icon = icon;
          const active = activeTab === id;
          return (
            <button key={id} style={s.tabBtn} onClick={() => onTabPress?.(id)}>
              <Icon color={active ? '#00D4AA' : 'rgba(255,255,255,0.38)'} />
              <span style={{ ...s.tabLabel, color: active ? '#00D4AA' : 'rgba(255,255,255,0.38)' }}>{label}</span>
              {active && <span style={s.tabDot} />}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function ActivityRow({ item, isHindi }) {
  const d = item.completedAt?.toDate?.() ?? (item.completedAt ? new Date(item.completedAt) : null);
  const dateStr = d ? d.toLocaleDateString(isHindi ? 'hi-IN' : 'en-IN', { day: '2-digit', month: 'short' }) : '—';
  return (
    <div style={s.activityRow}>
      <div style={s.activityLeft}>
        <span style={s.activityDate}>{dateStr}</span>
        <span style={s.activityUser}>{item.userName || '—'}</span>
      </div>
      <div style={s.activityRight}>
        <span style={s.activityKwh}>{item.kwh ?? '—'} kWh</span>
        <span style={s.activityAmt}>₹{item.finalAmount ?? '—'}</span>
      </div>
    </div>
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

function HomeIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 9.5L12 3l9 6.5V21a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 22V12h6v10" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
function RequestIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M8 6h13M8 12h13M8 18h13" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="4" cy="6" r="1" fill={color} />
      <circle cx="4" cy="12" r="1" fill={color} />
      <circle cx="4" cy="18" r="1" fill={color} />
    </svg>
  );
}
function EarningsIcon({ color }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 1v22M17 5.5c0-1.93-2.24-3.5-5-3.5S7 3.57 7 5.5 9.24 9 12 9s5 1.57 5 3.5S14.76 16 12 16s-5-1.57-5-3.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
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

const cssText = `
  * { box-sizing: border-box; }
  button { cursor: pointer; border: none; background: none; padding: 0; font-family: 'Inter', sans-serif; }
  ::-webkit-scrollbar { display: none; }
  @keyframes pulseDot { 0%,100% { opacity: 1; transform: scale(1);} 50% { opacity: .4; transform: scale(.72);} }
`;

const s = {
  page: {
    minHeight: '100dvh',
    background: '#0A0A0F',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'Inter', sans-serif",
    overflow: 'hidden',
    position: 'relative',
  },
  scroll: { flex: 1, overflowY: 'auto', paddingBottom: 80 },

  hero: {
    background: 'linear-gradient(180deg, rgba(0,212,170,0.10) 0%, transparent 100%)',
    padding: '52px 20px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  heroTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  greetingCol: { display: 'flex', flexDirection: 'column', gap: 4 },
  greetingLine: { fontSize: 20, color: 'rgba(255,255,255,0.84)', margin: 0 },
  firstName: { color: '#fff', fontWeight: 700 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.45)' },

  heroRight: { display: 'flex', alignItems: 'center', gap: 10 },
  avatarBtn: { borderRadius: '50%', overflow: 'hidden', flexShrink: 0 },
  avatarImg: { width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(0,212,170,.4)', display: 'block' },
  avatarCircle: { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', border: '2px solid rgba(0,212,170,.4)' },

  onlineToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
  onlineDot: { width: 8, height: 8, borderRadius: '50%' },
  onlineText: { fontSize: 12, fontWeight: 700 },

  body: { padding: 16 },

  activeCard: {
    borderRadius: 16,
    background: 'rgba(0,212,170,0.07)',
    border: '1px solid rgba(0,212,170,0.3)',
    borderLeft: '4px solid #00D4AA',
    marginBottom: 14,
    overflow: 'hidden',
  },
  activeCardInner: { padding: '14px 16px' },
  activeBadgeRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  activeBadge: { fontSize: 11, fontWeight: 700, color: '#00D4AA', background: 'rgba(0,212,170,0.15)', borderRadius: 6, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '.05em' },
  activePulse: { width: 7, height: 7, borderRadius: '50%', background: '#00D4AA', animation: 'pulseDot 1.4s ease-in-out infinite' },
  activeLine: { margin: '0 0 4px', fontSize: 13, color: 'rgba(255,255,255,.62)' },
  activeMeta: { margin: '0 0 12px', fontSize: 13, color: 'rgba(255,255,255,.45)' },

  primaryBtn: {
    width: '100%',
    padding: '11px',
    borderRadius: 10,
    background: '#00D4AA',
    color: '#0A0A0F',
    fontWeight: 700,
    fontSize: 14,
  },

  pendingCard: {
    marginBottom: 14,
    borderRadius: 12,
    border: '1px solid rgba(251,191,36,0.4)',
    borderLeft: '4px solid #F59E0B',
    background: 'rgba(245,158,11,0.10)',
    padding: '11px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  pendingText: { margin: 0, fontSize: 13, color: '#FCD34D', fontWeight: 600 },
  reviewBtn: {
    borderRadius: 8,
    background: '#F59E0B',
    color: '#111827',
    fontWeight: 700,
    fontSize: 12,
    padding: '7px 10px',
    flexShrink: 0,
  },

  earningsRow: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 16 },
  earnCard: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: '14px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    textAlign: 'left',
    boxShadow: '0 2px 8px rgba(0,0,0,.25)',
  },
  earnLabel: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  earnValue: { fontSize: 20, fontWeight: 700, color: '#00D4AA' },

  section: { marginBottom: 18 },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 11 },
  sectionTitle: { fontSize: 15, fontWeight: 700 },

  addBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    color: '#00D4AA',
    fontSize: 13,
    fontWeight: 700,
    padding: '6px 10px',
    borderRadius: 8,
    background: 'rgba(0,212,170,0.08)',
    border: '1px solid rgba(0,212,170,0.22)',
  },

  chargerList: { display: 'flex', flexDirection: 'column', gap: 10 },
  chargerCard: {
    width: '100%',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.09)',
    background: 'rgba(255,255,255,0.05)',
    padding: '11px 12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    textAlign: 'left',
    gap: 10,
  },
  chargerLeft: { display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 },
  chargerIcon: { width: 34, height: 34, borderRadius: 8, background: 'rgba(0,212,170,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  chargerTextWrap: { minWidth: 0 },
  chargerName: { margin: '0 0 3px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chargerMeta: { margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  statusBadge: { fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '4px 8px', flexShrink: 0 },

  emptyText: { margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '12px 0' },

  activityRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '11px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  activityLeft: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  activityDate: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  activityUser: { fontSize: 13, fontWeight: 500 },
  activityRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 },
  activityKwh: { fontSize: 11, color: 'rgba(255,255,255,0.45)' },
  activityAmt: { fontSize: 13, fontWeight: 600, color: '#00D4AA' },

  tabBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    display: 'flex',
    background: 'rgba(10,10,15,.95)',
    borderTop: '1px solid rgba(255,255,255,.07)',
    backdropFilter: 'blur(16px)',
  },
  tabBtn: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative' },
  tabLabel: { fontSize: 10, fontWeight: 500 },
  tabDot: { position: 'absolute', bottom: 8, width: 4, height: 4, borderRadius: '50%', background: '#00D4AA' },
};
