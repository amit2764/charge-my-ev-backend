import React, { useEffect } from 'react';
import { resolveBookingState } from '../resolveBookingState';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

/**
 * Screen 17 — Profile Screen (Web)
 */
export default function ProfileScreen({
  role = 'user',
  booking = null,
  myUserId,
  userProfile = {},
  isKycVerified = false,
  totalSessions = 0,
  averageRating = 0,
  hasCharger = false,
  hostStats = {},
  loading = false,
  onValidateVisibility,
  onExitFallback,
  onChangePhoto,
  onEditName,
  onOpenKyc,
  onOpenNotificationPreferences,
  onChangeLanguage,
  onOpenEditProfile,
  onOpenMyChargers,
  onOpenAvailability,
  onOpenEarningsDashboard,
  onToggleTheme,
  onOpenHelp,
  onOpenTerms,
  onOpenPrivacy,
  onRateApp,
  onLogout,
  onDeleteAccount,
}) {
  const { t, locale } = useI18n();
  const { c, isDark, toggleTheme } = useTheme();
  const isHindi = locale === 'hi';
  const s = makeStyles(c);

  function tx(key, fallback) {
    const v = t(key);
    return v === key ? fallback : v;
  }

  function handleThemeToggle() {
    toggleTheme();
    onToggleTheme?.(isDark ? 'light' : 'dark');
  }

  useEffect(() => {
    const resolved = resolveBookingState(booking, myUserId);
    onValidateVisibility?.(resolved);
    if (booking && resolved.screen !== 'HOME') {
      onExitFallback?.(resolved);
    }
  }, [booking, myUserId, onValidateVisibility, onExitFallback]);

  const displayName = userProfile?.name || (isHindi ? 'यूज़र नाम' : 'User Name');
  const phone = userProfile?.phone || userProfile?.phoneNumber || '—';
  const photo = userProfile?.avatar || userProfile?.photoUrl || '';
  const earned = Number(hostStats?.totalEarned || 0);
  const hostSessions = Number(hostStats?.totalSessions ?? totalSessions ?? 0);
  const hostAvg = Number(hostStats?.averageRating ?? averageRating ?? 0);

  return (
    <div style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <button type="button" style={s.avatarBtn} onClick={() => onChangePhoto?.()} aria-label="Change photo">
            {photo
              ? <img src={photo} alt="" style={s.avatarImg} referrerPolicy="no-referrer" />
              : <div style={s.avatarFallback}>{initials(displayName)}</div>}
          </button>

          <button type="button" style={s.nameBtn} onClick={() => onEditName?.()}>
            <h1 style={s.name}>{displayName}</h1>
            <span style={s.editHint}>{tx('profile.tapToEdit', isHindi ? 'संपादित करने के लिए टैप करें' : 'Tap to edit')}</span>
          </button>

          <p style={s.phone}>{phone}</p>

          <div style={s.verifyRow}>
            {isKycVerified
              ? <span style={s.verifiedBadge}>{tx('profile.verified', 'Verified')}</span>
              : (
                <button type="button" style={s.verifyLink} onClick={() => onOpenKyc?.()}>
                  {tx('profile.getVerified', isHindi ? 'Get verified' : 'Get verified')}
                </button>
              )}
          </div>

          <div style={s.ratingRow}>
            <Stars rating={averageRating} s={s} />
            <span style={s.ratingText}>{Number(averageRating || 0).toFixed(1)} · {totalSessions} {tx('profile.sessions', isHindi ? 'सेशन' : 'sessions')}</span>
          </div>
        </header>

        {role === 'host' && (
          <section style={s.hostStatsWrap}>
            <StatTile label={tx('profile.totalEarned', isHindi ? 'कुल कमाई' : 'Total earned')} value={`₹${earned.toFixed(0)}`} s={s} />
            <StatTile label={tx('profile.totalSessions', isHindi ? 'कुल सेशन' : 'Total sessions')} value={String(hostSessions)} s={s} />
            <StatTile label={tx('profile.avgRating', isHindi ? 'औसत रेटिंग' : 'Average rating')} value={hostAvg ? hostAvg.toFixed(1) : '—'} s={s} />
          </section>
        )}

        <Section title={tx('profile.account', 'Account')} s={s}>
          <MenuItem label={tx('profile.editProfile', 'Edit Profile')} onPress={onOpenEditProfile} s={s} />
          <MenuItem
            label={tx('profile.kycVerification', 'KYC Verification')}
            right={
              <span style={isKycVerified ? s.okPill : s.pendingPill}>
                {isKycVerified ? tx('profile.verified', 'Verified') : tx('profile.pending', 'Pending')}
              </span>
            }
            onPress={onOpenKyc}
            s={s}
          />
          <MenuItem label={tx('profile.notifications', 'Notification Preferences')} onPress={onOpenNotificationPreferences} s={s} />
          <LanguageRow
            label={tx('profile.language', 'Language')}
            language={locale}
            onChangeLanguage={onChangeLanguage}
            s={s}
          />
        </Section>

        {hasCharger && (
          <Section title={tx('profile.host', 'Host')} s={s}>
            <MenuItem label={tx('profile.myChargers', 'My Chargers')} onPress={onOpenMyChargers} s={s} />
            <MenuItem label={tx('profile.availability', 'Availability Schedule')} onPress={onOpenAvailability} s={s} />
            <MenuItem label={tx('profile.earningsDashboard', 'Earnings Dashboard')} onPress={onOpenEarningsDashboard} s={s} />
          </Section>
        )}

        <Section title={tx('profile.app', 'App')} s={s}>
          <ToggleRow
            label={tx('profile.theme', 'Dark / Light mode')}
            isDark={isDark}
            onToggle={handleThemeToggle}
            s={s}
            c={c}
          />
          <MenuItem label={tx('profile.help', 'Help & Support')} onPress={onOpenHelp} s={s} />
          <MenuItem label={tx('profile.terms', 'Terms of Service')} onPress={onOpenTerms} s={s} />
          <MenuItem label={tx('profile.privacy', 'Privacy Policy')} onPress={onOpenPrivacy} s={s} />
          <MenuItem label={tx('profile.rateApp', 'Rate the App')} onPress={onRateApp} s={s} />
        </Section>

        <Section title={tx('profile.dangerZone', 'Danger zone')} s={s}>
          <button type="button" style={s.dangerGhost} disabled={loading} onClick={() => onLogout?.()}>
            {tx('profile.logout', 'Log Out')}
          </button>
          <button type="button" style={s.deleteGhost} disabled={loading} onClick={() => onDeleteAccount?.()}>
            {tx('profile.deleteAccount', 'Delete Account')}
          </button>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children, s }) {
  return (
    <section style={s.section}>
      <p style={s.sectionTitle}>{title}</p>
      <div style={s.card}>{children}</div>
    </section>
  );
}

function MenuItem({ label, onPress, right = null, s }) {
  return (
    <button type="button" style={s.menuItem} onClick={() => onPress?.()}>
      <span style={s.menuLabel}>{label}</span>
      <span style={s.menuRight}>{right || '›'}</span>
    </button>
  );
}

function ToggleRow({ label, isDark, onToggle, s, c }) {
  return (
    <button type="button" style={s.menuItem} onClick={() => onToggle?.()}>
      <span style={s.menuLabel}>{label}</span>
      <span style={{ ...s.okPill, background: isDark ? c.brandPrimarySoft : c.border }}>
        {isDark ? 'Dark' : 'Light'}
      </span>
    </button>
  );
}

function LanguageRow({ label, language, onChangeLanguage, s }) {
  const lang = String(language || 'en').toLowerCase();
  return (
    <div style={s.languageRow}>
      <span style={s.menuLabel}>{label}</span>
      <div style={s.langPills}>
        <button type="button" style={lang === 'en' ? s.langPillActive : s.langPill} onClick={() => onChangeLanguage?.('en')}>English</button>
        <button type="button" style={lang === 'hi' ? s.langPillActive : s.langPill} onClick={() => onChangeLanguage?.('hi')}>हिंदी</button>
      </div>
    </div>
  );
}

function StatTile({ label, value, s }) {
  return (
    <div style={s.statTile}>
      <p style={s.statLabel}>{label}</p>
      <p style={s.statValue}>{value}</p>
    </div>
  );
}

function Stars({ rating = 0, s }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating || 0))));
  return (
    <div style={s.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} style={i <= n ? s.starOn : s.starOff}>★</span>
      ))}
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
    fontFamily: "'Inter', sans-serif",
  },
  container: {
    maxWidth: 430,
    margin: '0 auto',
    padding: '18px 16px 24px',
  },
  header: {
    border: `1px solid ${c.border}`,
    borderRadius: 18,
    background: c.surface,
    padding: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  avatarBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    border: `2px solid ${c.brandPrimary}72`,
    overflow: 'hidden',
    background: 'transparent',
    margin: '0 auto 10px',
    padding: 0,
    cursor: 'pointer',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    background: c.brandPrimarySoft,
    color: c.brandPrimary,
    display: 'grid',
    placeItems: 'center',
    fontWeight: 800,
    fontSize: 28,
  },
  nameBtn: {
    border: 'none',
    background: 'transparent',
    color: c.text,
    cursor: 'pointer',
  },
  name: {
    margin: 0,
    fontSize: 24,
    fontWeight: 800,
  },
  editHint: {
    fontSize: 11,
    color: c.textSoft,
  },
  phone: {
    margin: '6px 0 4px',
    fontSize: 13,
    color: c.textMuted,
  },
  verifyRow: {
    marginBottom: 6,
  },
  verifiedBadge: {
    display: 'inline-block',
    borderRadius: 999,
    background: c.brandPrimarySoft,
    color: c.brandPrimary,
    fontSize: 12,
    fontWeight: 700,
    padding: '3px 10px',
  },
  verifyLink: {
    border: 'none',
    background: 'transparent',
    color: c.brandPrimary,
    textDecoration: 'underline',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  ratingRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  stars: { display: 'flex', gap: 2, fontSize: 15 },
  starOn: { color: c.brandPrimary },
  starOff: { color: c.textSoft },
  ratingText: { fontSize: 12, color: c.textMuted },

  hostStatsWrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
    gap: 8,
    marginBottom: 12,
  },
  statTile: {
    border: `1px solid ${c.border}`,
    borderRadius: 12,
    background: c.surface,
    padding: '10px 8px',
    textAlign: 'center',
  },
  statLabel: { margin: 0, fontSize: 11, color: c.textMuted },
  statValue: { margin: '4px 0 0', fontSize: 16, fontWeight: 800, color: c.text },

  section: { marginBottom: 12 },
  sectionTitle: {
    margin: '0 0 8px',
    color: c.textMuted,
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  card: {
    border: `1px solid ${c.border}`,
    borderRadius: 14,
    overflow: 'hidden',
    background: c.surface,
  },
  menuItem: {
    width: '100%',
    border: 'none',
    borderBottom: `1px solid ${c.border}`,
    background: 'transparent',
    color: c.text,
    minHeight: 46,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    cursor: 'pointer',
  },
  menuLabel: {
    fontSize: 14,
    color: c.text,
  },
  menuRight: {
    fontSize: 14,
    color: c.textSoft,
  },
  languageRow: {
    minHeight: 46,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
  },
  langPills: { display: 'flex', gap: 6 },
  langPill: {
    border: `1px solid ${c.border}`,
    borderRadius: 999,
    background: c.surface,
    color: c.textMuted,
    fontSize: 12,
    padding: '4px 9px',
    cursor: 'pointer',
  },
  langPillActive: {
    border: `1px solid ${c.brandPrimary}`,
    borderRadius: 999,
    background: c.brandPrimarySoft,
    color: c.brandPrimary,
    fontSize: 12,
    padding: '4px 9px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  okPill: {
    borderRadius: 999,
    background: c.brandPrimarySoft,
    color: c.brandPrimary,
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 9px',
  },
  pendingPill: {
    borderRadius: 999,
    background: c.warningSoft,
    color: c.warning,
    fontSize: 11,
    fontWeight: 700,
    padding: '3px 9px',
  },
  dangerGhost: {
    width: '100%',
    border: 'none',
    borderBottom: `1px solid ${c.border}`,
    minHeight: 46,
    background: 'transparent',
    color: c.error,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  deleteGhost: {
    width: '100%',
    border: 'none',
    minHeight: 40,
    background: 'transparent',
    color: c.error,
    fontSize: 12,
    fontWeight: 600,
    opacity: 0.75,
    cursor: 'pointer',
  },
  };
}
