import React, { useEffect } from 'react';
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { resolveBookingState } from '../resolveBookingState';
import { useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';

/**
 * Screen 17 — Profile Screen (Native)
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
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <View style={s.headerCard}>
          <Pressable style={s.avatarBtn} onPress={() => onChangePhoto?.()}>
            {photo
              ? <Image source={{ uri: photo }} style={s.avatarImg} />
              : (
                <View style={s.avatarFallback}>
                  <Text style={s.avatarFallbackText}>{initials(displayName)}</Text>
                </View>
              )}
          </Pressable>

          <Pressable onPress={() => onEditName?.()}>
            <Text style={s.name}>{displayName}</Text>
            <Text style={s.editHint}>{tx('profile.tapToEdit', isHindi ? 'संपादित करने के लिए टैप करें' : 'Tap to edit')}</Text>
          </Pressable>

          <Text style={s.phone}>{phone}</Text>

          <View style={s.verifyRow}>
            {isKycVerified
              ? <Text style={s.verifiedBadge}>{tx('profile.verified', 'Verified')}</Text>
              : (
                <Pressable onPress={() => onOpenKyc?.()}>
                  <Text style={s.verifyLink}>{tx('profile.getVerified', isHindi ? 'Get verified' : 'Get verified')}</Text>
                </Pressable>
              )}
          </View>

          <View style={s.ratingRow}>
            <Stars rating={averageRating} s={s} />
            <Text style={s.ratingText}>{Number(averageRating || 0).toFixed(1)} · {totalSessions} {tx('profile.sessions', isHindi ? 'सेशन' : 'sessions')}</Text>
          </View>
        </View>

        {role === 'host' && (
          <View style={s.hostStatsRow}>
            <StatTile label={tx('profile.totalEarned', isHindi ? 'कुल कमाई' : 'Total earned')} value={`₹${earned.toFixed(0)}`} s={s} />
            <StatTile label={tx('profile.totalSessions', isHindi ? 'कुल सेशन' : 'Total sessions')} value={String(hostSessions)} s={s} />
            <StatTile label={tx('profile.avgRating', isHindi ? 'औसत रेटिंग' : 'Average rating')} value={hostAvg ? hostAvg.toFixed(1) : '—'} s={s} />
          </View>
        )}

        <Section title={tx('profile.account', 'Account')} s={s}>
          <MenuItem label={tx('profile.editProfile', 'Edit Profile')} onPress={onOpenEditProfile} s={s} />
          <MenuItem
            label={tx('profile.kycVerification', 'KYC Verification')}
            onPress={onOpenKyc}
            right={isKycVerified ? <Text style={s.okPill}>Verified</Text> : <Text style={s.pendingPill}>Pending</Text>}
            s={s}
          />
          <MenuItem label={tx('profile.notifications', 'Notification Preferences')} onPress={onOpenNotificationPreferences} s={s} />
          <LanguageRow label={tx('profile.language', 'Language')} language={locale} onChangeLanguage={onChangeLanguage} s={s} />
        </Section>

        {hasCharger && (
          <Section title={tx('profile.host', 'Host')} s={s}>
            <MenuItem label={tx('profile.myChargers', 'My Chargers')} onPress={onOpenMyChargers} s={s} />
            <MenuItem label={tx('profile.availability', 'Availability Schedule')} onPress={onOpenAvailability} s={s} />
            <MenuItem label={tx('profile.earningsDashboard', 'Earnings Dashboard')} onPress={onOpenEarningsDashboard} s={s} />
          </Section>
        )}

        <Section title={tx('profile.app', 'App')} s={s}>
          <ToggleRow label={tx('profile.theme', 'Dark / Light mode')} isDark={isDark} onToggle={handleThemeToggle} s={s} c={c} />
          <MenuItem label={tx('profile.help', 'Help & Support')} onPress={onOpenHelp} s={s} />
          <MenuItem label={tx('profile.terms', 'Terms of Service')} onPress={onOpenTerms} s={s} />
          <MenuItem label={tx('profile.privacy', 'Privacy Policy')} onPress={onOpenPrivacy} s={s} />
          <MenuItem label={tx('profile.rateApp', 'Rate the App')} onPress={onRateApp} s={s} />
        </Section>

        <Section title={tx('profile.dangerZone', 'Danger zone')} s={s}>
          <Pressable style={[s.dangerGhost, loading && { opacity: 0.5 }]} disabled={loading} onPress={() => onLogout?.()}>
            <Text style={s.dangerText}>{tx('profile.logout', 'Log Out')}</Text>
          </Pressable>
          <Pressable style={[s.deleteGhost, loading && { opacity: 0.5 }]} disabled={loading} onPress={() => onDeleteAccount?.()}>
            <Text style={s.deleteText}>{tx('profile.deleteAccount', 'Delete Account')}</Text>
          </Pressable>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children, s }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.card}>{children}</View>
    </View>
  );
}

function MenuItem({ label, onPress, right = null, s }) {
  return (
    <Pressable style={s.menuItem} onPress={() => onPress?.()}>
      <Text style={s.menuLabel}>{label}</Text>
      {right || <Text style={s.menuRight}>›</Text>}
    </Pressable>
  );
}

function ToggleRow({ label, isDark, onToggle, s, c }) {
  return (
    <Pressable style={s.menuItem} onPress={() => onToggle?.()}>
      <Text style={s.menuLabel}>{label}</Text>
      <Text style={[s.modePill, { backgroundColor: isDark ? c.brandPrimarySoft : c.border, color: isDark ? c.brandPrimary : c.text }]}>
        {isDark ? 'Dark' : 'Light'}
      </Text>
    </Pressable>
  );
}

function LanguageRow({ label, language, onChangeLanguage, s }) {
  const lang = String(language || 'en').toLowerCase();
  return (
    <View style={s.langRow}>
      <Text style={s.menuLabel}>{label}</Text>
      <View style={s.langPills}>
        <Pressable style={lang === 'en' ? s.langPillActive : s.langPill} onPress={() => onChangeLanguage?.('en')}>
          <Text style={lang === 'en' ? s.langPillActiveText : s.langPillText}>English</Text>
        </Pressable>
        <Pressable style={lang === 'hi' ? s.langPillActive : s.langPill} onPress={() => onChangeLanguage?.('hi')}>
          <Text style={lang === 'hi' ? s.langPillActiveText : s.langPillText}>हिंदी</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StatTile({ label, value, s }) {
  return (
    <View style={s.statTile}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
    </View>
  );
}

function Stars({ rating = 0, s }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating || 0))));
  return (
    <View style={s.stars}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={String(i)} style={i <= n ? s.starOn : s.starOff}>★</Text>
      ))}
    </View>
  );
}

function initials(name = '') {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

function makeStyles(c) {
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.page,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 28,
  },

  headerCard: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 18,
    backgroundColor: c.surface,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: c.brandPrimary,
    overflow: 'hidden',
    marginBottom: 10,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    backgroundColor: c.brandPrimarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: c.brandPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  name: {
    color: c.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  editHint: {
    color: c.textSoft,
    fontSize: 11,
    textAlign: 'center',
  },
  phone: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 4,
  },
  verifyRow: {
    marginBottom: 6,
  },
  verifiedBadge: {
    borderRadius: 999,
    backgroundColor: c.brandPrimarySoft,
    color: c.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  verifyLink: {
    color: c.brandPrimary,
    textDecorationLine: 'underline',
    fontWeight: '700',
    fontSize: 13,
  },
  ratingRow: {
    alignItems: 'center',
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  starOn: { color: c.brandPrimary, fontSize: 15 },
  starOff: { color: c.textSoft, fontSize: 15 },
  ratingText: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },

  hostStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.surface,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statLabel: {
    color: c.textMuted,
    fontSize: 11,
  },
  statValue: {
    color: c.text,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },

  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: c.surface,
  },
  menuItem: {
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuLabel: {
    color: c.text,
    fontSize: 14,
  },
  menuRight: {
    color: c.textSoft,
    fontSize: 14,
  },
  okPill: {
    borderRadius: 999,
    backgroundColor: c.brandPrimarySoft,
    color: c.brandPrimary,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  pendingPill: {
    borderRadius: 999,
    backgroundColor: c.warningSoft,
    color: c.warning,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  modePill: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 9,
    paddingVertical: 3,
    overflow: 'hidden',
  },

  langRow: {
    minHeight: 46,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  langPills: {
    flexDirection: 'row',
    gap: 6,
  },
  langPill: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 999,
    backgroundColor: c.surface,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  langPillActive: {
    borderWidth: 1,
    borderColor: c.brandPrimary,
    borderRadius: 999,
    backgroundColor: c.brandPrimarySoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  langPillText: {
    color: c.textMuted,
    fontSize: 12,
  },
  langPillActiveText: {
    color: c.brandPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  dangerGhost: {
    minHeight: 46,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerText: {
    color: c.error,
    fontSize: 14,
    fontWeight: '700',
  },
  deleteGhost: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: c.error,
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.75,
  },
  });
}
