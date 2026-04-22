import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { useStore } from './store';
import { initFCM, onForegroundMessage } from './utils/fcm';
import LoginScreen from './LoginScreen';
import UserFlow from './UserFlow';
import HostFlow from './HostFlow';
import PINSetup from './components/PINSetup';
import PINUnlock from './components/PINUnlock';
import UserHomeScreen from './screens/user/HomeScreen';
import HostHomeScreen from './screens/host/HomeScreen';
import MatchingScreen from './screens/user/MatchingScreen';
import BookingConfirmScreen from './screens/BookingConfirmScreen';
import ChargingSessionScreen from './screens/ChargingSessionScreen';
import PaymentScreen from './screens/PaymentScreen';
import RatingScreen from './screens/RatingScreen';
import ProfileScreen from './screens/ProfileScreen';
import SessionHistoryScreen from './screens/SessionHistoryScreen';
import EarningsDashboardScreen from './screens/host/EarningsDashboardScreen';
import UserDiscoveryMapScreen from './screens/user/DiscoveryMapScreen';
import { DEFAULT_TAB_BY_ROLE, VALID_TABS_BY_ROLE, USER_TABS, HOST_TABS } from './navigation';
import { useThemeStore } from './hooks/useTheme';
import useNearbyHosts from './hooks/useNearbyHosts';
import { useI18n } from './i18n';
import { resolveBookingState } from './resolveBookingState';
import useSessionHistory from './hooks/useSessionHistory';
import api from './api';

function getDefaultTab(role) {
  return DEFAULT_TAB_BY_ROLE[role] || DEFAULT_TAB_BY_ROLE.user;
}

function isValidTab(role, tab) {
  return VALID_TABS_BY_ROLE[role]?.has(tab) ?? false;
}

export default function App() {
  const {
    user,
    role,
    setRole,
    logout,
    setUser,
    activeBooking,
    activeRequest,
    setActiveRequest,
    setActiveBooking,
    userProfile,
    hostProfile,
  } = useStore();
  const { isDark } = useThemeStore();
  const { t, setLanguage } = useI18n();
  const { hosts: nearbyHosts, filters: nearbyFilters, setFilters: setNearbyFilters } = useNearbyHosts(8);
  const { items: userHistoryItems } = useSessionHistory({ userId: user, role: 'user', pageSize: 20 });
  const { items: hostHistoryItems } = useSessionHistory({ userId: user, role: 'host', pageSize: 20 });
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [tabsByRole, setTabsByRole] = useState({
    user: DEFAULT_TAB_BY_ROLE.user,
    host: DEFAULT_TAB_BY_ROLE.host
  });
  const [foregroundBanner, setForegroundBanner] = useState(null);
  const [discoveryFilters, setDiscoveryFilters] = useState([]);
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowError, setFlowError] = useState('');
  const [isHostOnline, setIsHostOnline] = useState(false);

  const tx = (key, fallback) => {
    const val = t(key);
    return val === key ? fallback : val;
  };

  // Wait for Firebase Auth to restore its session before allowing Firestore reads.
  // Without this gate, onSnapshot / getDocs fire while request.auth is still null
  // (Firebase Auth restores from IndexedDB asynchronously), producing
  // "Missing or insufficient permissions" errors on every page load.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, () => setFirebaseReady(true));
    return unsub;
  }, []);

  // FCM: init token on every app open, refresh silently
  useEffect(() => {
    if (!user) return;
    void initFCM(user);
  }, [user]);

  // FCM: show in-app banner for foreground notifications
  useEffect(() => {
    if (!user) return;
    const unsub = onForegroundMessage((payload) => {
      const title = payload.notification?.title || 'Charge My EV';
      const body = payload.notification?.body || '';
      setForegroundBanner({ title, body, deepLink: payload.data?.deepLink || null });
      setTimeout(() => setForegroundBanner(null), 5000);
    });
    return () => unsub();
  }, [user]);

  // Apply data-theme attribute so CSS variables and dark: Tailwind classes respond
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const authGate = useMemo(() => {
    const rememberedUser = localStorage.getItem('authUser') || localStorage.getItem('user') || null;
    const pinHash = localStorage.getItem('pinHash') || null;

    if (user && !pinHash) {
      return { mode: 'setup', rememberedUser: user };
    }

    if (!user && rememberedUser && pinHash) {
      return { mode: 'unlock', rememberedUser };
    }

    return { mode: 'none', rememberedUser: rememberedUser || null };
  }, [user]);

  const effectiveRole = role;
  const effectiveTab = isValidTab(effectiveRole, tabsByRole[effectiveRole])
    ? tabsByRole[effectiveRole]
    : getDefaultTab(effectiveRole);

  const setRoleTab = (targetRole, nextTab) => {
    setTabsByRole(prev => ({
      ...prev,
      [targetRole]: isValidTab(targetRole, nextTab) ? nextTab : getDefaultTab(targetRole)
    }));
  };

  const switchRoleFromProfile = (nextRole) => {
    setRole(nextRole);
    setRoleTab(nextRole, 'profile');
  };

  const normalizedProfile = effectiveRole === 'host' ? (hostProfile || userProfile || {}) : (userProfile || hostProfile || {});
  const bookingResolution = useMemo(() => resolveBookingState(activeBooking, user), [activeBooking, user]);

  const syncActiveBookingFromBackend = useCallback(async (targetRole = role) => {
    if (!user) return;
    try {
      const res = await api.get(`/api/bookings/active?userId=${encodeURIComponent(user)}&role=${encodeURIComponent(targetRole)}`);
      const backendBooking = res.data?.booking || null;
      if (backendBooking) {
        setActiveBooking(backendBooking, targetRole);
      } else {
        setActiveBooking(null);
      }
    } catch {
      // Keep current local booking if backend read fails temporarily.
    }
  }, [role, setActiveBooking, user]);

  useEffect(() => {
    if (!user) return;
    void syncActiveBookingFromBackend(role);
    const timer = setInterval(() => {
      void syncActiveBookingFromBackend(role);
    }, 12000);
    return () => clearInterval(timer);
  }, [role, syncActiveBookingFromBackend, user]);

  const userSummary = useMemo(() => {
    const sessions = userHistoryItems || [];
    const totalKwh = sessions.reduce((sum, item) => sum + Number(item.kwh || item.energyKwh || item.deliveredKwh || 0), 0);
    const totalSpent = sessions.reduce((sum, item) => sum + Number(item.finalAmount || item.amount || 0), 0);
    return {
      sessions: sessions.length,
      kwh: Number(totalKwh.toFixed(2)),
      spent: Math.round(totalSpent),
    };
  }, [userHistoryItems]);

  const hostSummary = useMemo(() => {
    const sessions = hostHistoryItems || [];
    const now = new Date();
    const todayKey = now.toDateString();
    const month = now.getMonth();
    const year = now.getFullYear();

    let today = 0;
    let monthTotal = 0;
    for (const item of sessions) {
      const amount = Number(item.finalAmount || item.amount || 0);
      const dt = item.completedAt?.toDate?.() || (item.completedAt ? new Date(item.completedAt) : (item.date ? new Date(item.date) : null));
      if (!dt || Number.isNaN(dt.getTime())) continue;
      if (dt.toDateString() === todayKey) today += amount;
      if (dt.getFullYear() === year && dt.getMonth() === month) monthTotal += amount;
    }

    return { today: Math.round(today), month: Math.round(monthTotal) };
  }, [hostHistoryItems]);

  const handleStartCharging = async (otp) => {
    if (!activeBooking?.id || !otp) return;
    setFlowLoading(true);
    setFlowError('');
    try {
      const res = await api.post('/api/start', { bookingId: activeBooking.id, otp });
      if (res.data?.booking) {
        setActiveBooking(res.data.booking, 'user');
      }
      await syncActiveBookingFromBackend('user');
    } catch (err) {
      setFlowError(err.response?.data?.error || err.message || 'Failed to start charging.');
    } finally {
      setFlowLoading(false);
    }
  };

  const handleStopCharging = async (otp) => {
    if (!activeBooking?.id || !otp) return;
    setFlowLoading(true);
    setFlowError('');
    try {
      let res;
      try {
        res = await api.post('/api/session/stop', { bookingId: activeBooking.id, otp, userId: user });
      } catch (primaryErr) {
        if (primaryErr?.response?.status === 404) {
          res = await api.post('/api/stop', { bookingId: activeBooking.id, otp });
        } else {
          throw primaryErr;
        }
      }

      if (res.data?.booking) {
        setActiveBooking(res.data.booking, 'user');
      }
      await syncActiveBookingFromBackend('user');
    } catch (err) {
      setFlowError(err.response?.data?.error || err.message || 'Failed to stop charging.');
    } finally {
      setFlowLoading(false);
    }
  };

  const handleEmergencyStop = async () => {
    if (!activeBooking?.id) return;
    setFlowLoading(true);
    setFlowError('');
    try {
      await api.post('/api/session/emergency-stop', { bookingId: activeBooking.id, userId: user });
      await syncActiveBookingFromBackend('user');
    } catch (err) {
      setFlowError(err.response?.data?.error || err.message || 'Emergency stop failed.');
    } finally {
      setFlowLoading(false);
    }
  };

  const handlePaymentConfirm = async (confirmRole) => {
    if (!activeBooking?.id) return;
    setFlowLoading(true);
    setFlowError('');
    try {
      const res = await api.post(`/api/bookings/${activeBooking.id}/payment-confirm`, { role: confirmRole });
      if (res.data?.booking) {
        setActiveBooking(res.data.booking, confirmRole);
      }
      await syncActiveBookingFromBackend(confirmRole);
    } catch (err) {
      setFlowError(err.response?.data?.error || err.message || 'Payment confirmation failed.');
    } finally {
      setFlowLoading(false);
    }
  };

  const handleRatingSubmit = async ({ rating, comment }) => {
    if (!activeBooking?.id) return;
    setFlowLoading(true);
    setFlowError('');
    try {
      const toUserId = activeBooking.hostId || activeBooking.userId;
      await api.post('/api/ratings', {
        bookingId: activeBooking.id,
        fromUserId: user,
        toUserId,
        role: 'user',
        stars: Number(rating),
        comment: String(comment || '').slice(0, 200),
      });
      setActiveBooking(null);
      setActiveRequest(null);
    } catch (err) {
      setFlowError(err.response?.data?.error || err.message || 'Failed to submit rating.');
    } finally {
      setFlowLoading(false);
    }
  };

  const mappedDiscoveryChargers = useMemo(() => {
    return (nearbyHosts || []).map((host, idx) => ({
      id: String(host.id || host.hostId || host.userId || idx),
      lat: Number(host.lat ?? host.latitude ?? 0),
      lng: Number(host.lng ?? host.longitude ?? 0),
      status: host.available === false ? 'OFFLINE' : 'AVAILABLE',
      hostName: host.name || host.hostName || 'Host Charger',
      hostAvatar: host.photoUrl || host.avatar || '',
      kycVerified: Boolean(host.kycVerified),
      rating: Number(host.rating || 0),
      reviewCount: Number(host.reviewCount || 0),
      distanceKm: Number(host.distance || 0),
      connectorType: host.connectorType || 'Type 2',
      powerKw: Number(host.powerKw || 0),
      pricePerKwh: Number(host.pricePerUnit || host.pricePerKwh || 0),
      pricePerHour: Number(host.pricePerHour || 0),
      nextAvailableAt: host.nextAvailableAt || null,
      raw: host,
    })).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng) && item.lat !== 0 && item.lng !== 0);
  }, [nearbyHosts]);

  const mappedDiscoveryFilterKeys = useMemo(() => {
    const next = [];
    if (nearbyFilters.connectorType) next.push(nearbyFilters.connectorType);
    if (nearbyFilters.minKw && Number(nearbyFilters.minKw) > 22) next.push('Fast (>22kW)');
    if (discoveryFilters.includes('Available now')) next.push('Available now');
    return next;
  }, [nearbyFilters, discoveryFilters]);

  const toggleDiscoveryFilter = (filter) => {
    setDiscoveryFilters((prev) => {
      const exists = prev.includes(filter);
      const next = exists ? prev.filter((f) => f !== filter) : [...prev, filter];

      const connectorFilters = ['Type 1', 'Type 2', 'CCS', 'CHAdeMO'];
      const selectedConnector = connectorFilters.find((f) => next.includes(f)) || '';
      const wantsFast = next.includes('Fast (>22kW)');

      setNearbyFilters((current) => ({
        ...current,
        connectorType: selectedConnector,
        minKw: wantsFast ? '23' : '',
      }));

      return next;
    });
  };

  const forcePhoneOtp = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('authUser');
    localStorage.removeItem('quickUnlockFailures');
    setUser(null);
  };

  if (!firebaseReady) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#f5fffc] dark:bg-[#0A0A0F]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-300/40 border-t-teal-500 dark:border-teal-700/40 dark:border-t-teal-400" />
      </div>
    );
  }

  if (authGate.mode === 'setup' && user) {
    return (
      <PINSetup
        userId={user}
        onComplete={() => {}}
        onUsePhone={forcePhoneOtp}
      />
    );
  }

  if (authGate.mode === 'unlock' && !user) {
    return (
      <PINUnlock
        rememberedUser={authGate.rememberedUser}
        onSuccess={(unlockedUser) => {
          localStorage.removeItem('quickUnlockFailures');
          setUser(unlockedUser);
        }}
        onForceOtp={forcePhoneOtp}
      />
    );
  }

  if (!user) return <LoginScreen />;

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-none bg-transparent text-slate-800 dark:text-slate-100 md:min-h-screen md:max-w-6xl md:px-4 md:py-5">
      <div className="relative flex min-h-[100dvh] flex-1 flex-col overflow-hidden border border-teal-100 dark:border-slate-700/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,253,250,0.94))] dark:bg-[linear-gradient(180deg,rgba(14,17,26,0.99),rgba(20,23,32,0.98))] shadow-[0_30px_80px_rgba(13,148,136,0.12)] dark:shadow-[0_30px_80px_rgba(0,0,0,0.5)] md:rounded-[32px]">
      <div className="ambient-orb left-[-90px] top-[-60px] h-48 w-48 bg-teal-300/30" />
      <div className="ambient-orb right-[-80px] top-20 h-40 w-40 bg-emerald-300/20" />
      {foregroundBanner && (
        <div
          role="alert"
          onClick={() => {
            if (foregroundBanner.deepLink) window.location.href = foregroundBanner.deepLink;
            setForegroundBanner(null);
          }}
          className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] z-[2000] mx-auto max-w-md cursor-pointer rounded-[24px] border border-teal-200 dark:border-teal-800/50 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,253,250,0.95))] dark:bg-[linear-gradient(135deg,rgba(20,23,32,0.98),rgba(26,31,43,0.95))] px-4 py-3 shadow-[0_20px_50px_rgba(13,148,136,0.14)] backdrop-blur-xl"
        >
          <p className="text-sm font-bold text-teal-700 dark:text-teal-300">{foregroundBanner.title}</p>
          {foregroundBanner.body && <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{foregroundBanner.body}</p>}
        </div>
      )}
      
      {/* Global Mobile Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-teal-100 dark:border-slate-700/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(247,254,252,0.9))] dark:bg-[linear-gradient(180deg,rgba(14,17,26,0.98),rgba(20,23,32,0.96))] px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.55rem)] backdrop-blur-xl sm:px-4 md:px-5 md:pb-4 md:pt-4">
        <div className="min-w-0 flex-1 px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-teal-600 dark:text-teal-400">Charge My EV</p>
          <h1 className="truncate text-lg font-black text-slate-900 dark:text-white sm:text-xl">
            {effectiveRole === 'host'
              ? tx('appShell.hostWorkspace', 'Host workspace')
              : tx('appShell.userWorkspace', 'User workspace')}
          </h1>
        </div>

        <button onClick={logout} className="glass-surface shrink-0 rounded-[18px] px-4 py-2 text-sm font-bold text-rose-600 transition hover:border-rose-200 hover:text-rose-700">
          {tx('appShell.logout', 'Logout')}
        </button>
      </header>

      {/* Dynamic Screen Content */}
      <div className="scrollbar-hide flex-1 overflow-y-auto overscroll-contain pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:px-1">
        {effectiveRole === 'user' ? (
          <>
            {effectiveTab === USER_TABS.CHARGE && (
              <>
                {flowError && (
                  <div className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/30 dark:text-rose-200">
                    {flowError}
                  </div>
                )}

                {!activeBooking && !activeRequest && (
                  <UserHomeScreen
                    user={{ displayName: normalizedProfile?.name || user, photoURL: normalizedProfile?.photoUrl || normalizedProfile?.avatar || '' }}
                    stats={userSummary}
                    activeBooking={null}
                    nearbyChargers={mappedDiscoveryChargers.map((c) => ({
                      id: c.id,
                      hostName: c.hostName,
                      rating: c.rating,
                      distance: Number(c.distanceKm || 0).toFixed(1),
                      pricePerKwh: c.pricePerKwh,
                      connectorType: c.connectorType,
                      available: c.status === 'AVAILABLE',
                    }))}
                    recentSessions={userHistoryItems}
                    onMapPress={() => setRoleTab('user', USER_TABS.DISCOVER)}
                    onSeeAllChargers={() => setRoleTab('user', USER_TABS.DISCOVER)}
                    onChargerPress={(charger) => {
                      const match = mappedDiscoveryChargers.find((c) => c.id === charger?.id);
                      if (match?.raw) {
                        localStorage.setItem('discoveryPrefillHost', JSON.stringify(match.raw));
                      }
                      setRoleTab('user', USER_TABS.DISCOVER);
                    }}
                    onContinueSession={() => {}}
                  />
                )}

                {!activeBooking && activeRequest && (
                  <MatchingScreen
                    host={{ name: activeRequest?.hostName || tx('appShell.hostFallback', 'Host Charger') }}
                    expiresInSeconds={58}
                    onCancelRequest={() => setActiveRequest(null)}
                    onExpire={() => setActiveRequest(null)}
                  />
                )}

                {activeBooking && (bookingResolution.screen === 'CONFIRM' || bookingResolution.screen === 'CHARGING_WAIT') && (
                  <BookingConfirmScreen
                    role="user"
                    booking={activeBooking}
                    counterparty={{ name: activeBooking.hostName || tx('appShell.hostFallback', 'Host Charger') }}
                    startPin={String(activeBooking?.startPin || activeBooking?.otp || '').slice(0, 4)}
                    loading={flowLoading}
                    onSubmitStartPin={handleStartCharging}
                    onDirections={() => setRoleTab('user', USER_TABS.DISCOVER)}
                  />
                )}

                {activeBooking && bookingResolution.screen === 'CHARGING_RUN' && (
                  <ChargingSessionScreen
                    loading={flowLoading}
                    session={{
                      startedAt: activeBooking.startTime || activeBooking.startedAt,
                      kwhDelivered: Number(activeBooking.energyKwh || activeBooking.kwh || 0),
                      powerKw: Number(activeBooking.powerKw || 7.2),
                      ratePerKwh: Number(activeBooking.pricePerUnit || activeBooking.price || 22),
                      mode: activeBooking.chargingMode || 'FAST',
                      targetKwh: Number(activeBooking.targetKwh || 24),
                      estimatedRemaining: activeBooking.estimatedRemaining || '00:45:00',
                    }}
                    onOpenChat={() => {}}
                    onStopCharging={handleStopCharging}
                    onEmergencyStop={handleEmergencyStop}
                  />
                )}

                {activeBooking && bookingResolution.screen === 'PAYMENT' && (
                  <PaymentScreen
                    loading={flowLoading}
                    paymentSubState={bookingResolution.subState}
                    durationText={activeBooking.duration || '--'}
                    kwhDelivered={Number(activeBooking.energyKwh || activeBooking.kwh || 0)}
                    ratePerKwh={Number(activeBooking.pricePerUnit || activeBooking.price || 22)}
                    subtotal={Number(activeBooking.subtotal || activeBooking.amount || activeBooking.finalAmount || 0)}
                    promoDiscount={Number(activeBooking.promoDiscount || 0)}
                    platformFee={Number(activeBooking.platformFee || 0)}
                    total={Number(activeBooking.finalAmount || activeBooking.amount || 0)}
                    paymentMethod={String(activeBooking.paymentMethod || 'CASH').toUpperCase()}
                    upiId={activeBooking.upiId || ''}
                    host={{ name: activeBooking.hostName || tx('appShell.hostFallback', 'Host Charger') }}
                    user={{ name: normalizedProfile?.name || user }}
                    elapsedMinutes={Number(activeBooking.elapsedMinutes || 0)}
                    autoResolveSecondsRemaining={Number(activeBooking.autoResolveSecondsRemaining || 0)}
                    onUserConfirmPaid={() => handlePaymentConfirm('user')}
                    onOpenChat={() => {}}
                    onExitForNow={() => setRoleTab('user', USER_TABS.CHARGE)}
                  />
                )}

                {activeBooking && bookingResolution.screen === 'RATING' && (
                  <RatingScreen
                    loading={flowLoading}
                    role="user"
                    party={{ name: activeBooking.hostName || tx('appShell.hostFallback', 'Host Charger') }}
                    summary={{
                      kwh: Number(activeBooking.energyKwh || activeBooking.kwh || 0),
                      duration: activeBooking.duration || '--',
                      amount: Number(activeBooking.finalAmount || activeBooking.amount || 0),
                    }}
                    onSubmitRating={handleRatingSubmit}
                    onSkip={() => {
                      setActiveBooking(null);
                      setActiveRequest(null);
                    }}
                  />
                )}

                {activeBooking && !['CONFIRM', 'CHARGING_WAIT', 'CHARGING_RUN', 'PAYMENT', 'RATING'].includes(bookingResolution.screen) && (
                  <UserFlow />
                )}
              </>
            )}
            {effectiveTab === USER_TABS.DISCOVER && (
              <UserDiscoveryMapScreen
                isDark={isDark}
                chargers={mappedDiscoveryChargers}
                filters={mappedDiscoveryFilterKeys}
                onToggleFilter={toggleDiscoveryFilter}
                onRequestCharge={(charger) => {
                  if (charger?.raw) {
                    localStorage.setItem('discoveryPrefillHost', JSON.stringify(charger.raw));
                  }
                  setRoleTab('user', USER_TABS.CHARGE);
                }}
                onSearch={() => {}}
                onGetDirections={() => {}}
                onOpenHostDetail={() => {}}
                onSelectCharger={() => {}}
                onLocateMe={() => {}}
                onToggleListView={() => {}}
              />
            )}
            {effectiveTab === USER_TABS.HISTORY && (
              <SessionHistoryScreen
                booking={activeBooking}
                myUserId={user}
                role="user"
                onPrimaryAction={() => setRoleTab('user', USER_TABS.DISCOVER)}
                onExitForNow={() => setRoleTab('user', USER_TABS.CHARGE)}
              />
            )}
            {effectiveTab === USER_TABS.PROFILE && (
              <ProfileScreen
                role={effectiveRole}
                booking={activeBooking}
                myUserId={user}
                userProfile={normalizedProfile}
                isKycVerified={Boolean(normalizedProfile?.kycVerified)}
                hasCharger={Boolean(hostProfile)}
                onToggleTheme={() => {}}
                onChangeLanguage={setLanguage}
                onOpenKyc={() => {}}
                onOpenNotificationPreferences={() => {}}
                onOpenEditProfile={() => {}}
                onOpenMyChargers={() => setRoleTab('host', HOST_TABS.DASHBOARD)}
                onOpenAvailability={() => setRoleTab('host', HOST_TABS.DASHBOARD)}
                onOpenEarningsDashboard={() => setRoleTab('host', HOST_TABS.EARNINGS)}
                onOpenHelp={() => {}}
                onOpenTerms={() => {}}
                onOpenPrivacy={() => {}}
                onRateApp={() => {}}
                onLogout={logout}
                onDeleteAccount={() => {}}
                onSwitchRole={switchRoleFromProfile}
              />
            )}
          </>
        ) : (
          <>
            {effectiveTab === HOST_TABS.DASHBOARD && (
              <>
                {flowError && (
                  <div className="mx-4 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800/60 dark:bg-rose-900/30 dark:text-rose-200">
                    {flowError}
                  </div>
                )}

                {/* No active booking — show home dashboard */}
                {!activeBooking && (
                  <HostHomeScreen
                    host={{ displayName: normalizedProfile?.name || user, photoURL: normalizedProfile?.photoUrl || normalizedProfile?.avatar || '' }}
                    isOnline={isHostOnline}
                    onToggleOnline={setIsHostOnline}
                    activeBooking={null}
                    pendingRequests={[]}
                    earnings={hostSummary}
                    chargers={Array.isArray(normalizedProfile?.chargers) ? normalizedProfile.chargers : []}
                    recentActivity={hostHistoryItems}
                    onManageSession={() => {}}
                    onReviewRequests={() => {}}
                    onOpenEarnings={() => setRoleTab('host', HOST_TABS.EARNINGS)}
                    onAddCharger={() => setRoleTab('host', HOST_TABS.PROFILE)}
                    onOpenCharger={() => {}}
                  />
                )}

                {/* Active booking — CONFIRM / CHARGING_WAIT: host sees booking details + start PIN display */}
                {activeBooking && (bookingResolution.screen === 'CONFIRM' || bookingResolution.screen === 'CHARGING_WAIT') && (
                  <BookingConfirmScreen
                    role="host"
                    booking={activeBooking}
                    counterparty={{ name: activeBooking?.userDisplayName || activeBooking?.userId || 'User' }}
                    startPin={activeBooking?.startPin || ''}
                    loading={flowLoading}
                    onValidateVisibility={() => {}}
                  />
                )}

                {/* Active booking — CHARGING_RUN: host sees live session + can stop */}
                {activeBooking && bookingResolution.screen === 'CHARGING_RUN' && (
                  <ChargingSessionScreen
                    role="host"
                    session={{
                      bookingId: activeBooking?.id,
                      hostName: normalizedProfile?.name || 'Host',
                      address: activeBooking?.address || '',
                      connectorType: activeBooking?.chargingMode || 'AC',
                      ratePerKwh: activeBooking?.price || 0,
                      startedAt: activeBooking?.startedAt,
                      kwhDelivered: activeBooking?.kwhDelivered || 0,
                      estimatedTotal: activeBooking?.estimatedTotal || 0,
                      stopPin: activeBooking?.stopPin || '',
                    }}
                    loading={flowLoading}
                    onStopCharging={handleStopCharging}
                    onEmergencyStop={handleEmergencyStop}
                  />
                )}

                {/* Active booking — PAYMENT: host confirms payment received */}
                {activeBooking && bookingResolution.screen === 'PAYMENT' && (
                  <PaymentScreen
                    paymentSubState={bookingResolution.subState}
                    kwhDelivered={activeBooking?.kwhDelivered || 0}
                    total={activeBooking?.totalAmount || activeBooking?.price || 0}
                    paymentMethod={activeBooking?.paymentMethod || 'CASH'}
                    host={{ name: normalizedProfile?.name || 'Host' }}
                    user={{ name: activeBooking?.userDisplayName || activeBooking?.userId || 'User' }}
                    loading={flowLoading}
                    onHostConfirmReceived={() => handlePaymentConfirm('host')}
                    onExitForNow={() => setRoleTab('host', HOST_TABS.EARNINGS)}
                    onValidateVisibility={() => {}}
                  />
                )}

                {/* Active booking — RATING: host rates user */}
                {activeBooking && bookingResolution.screen === 'RATING' && (
                  <RatingScreen
                    role="host"
                    booking={activeBooking}
                    counterparty={{ name: activeBooking?.userDisplayName || activeBooking?.userId || 'User' }}
                    onSubmitRating={handleRatingSubmit}
                    onSkip={() => { setActiveBooking(null); setActiveRequest(null); }}
                  />
                )}

                {/* Unrecognised state while booking exists — legacy fallback */}
                {activeBooking && !['CONFIRM', 'CHARGING_WAIT', 'CHARGING_RUN', 'PAYMENT', 'RATING'].includes(bookingResolution.screen) && (
                  <HostFlow />
                )}
              </>
            )}
            {effectiveTab === HOST_TABS.EARNINGS && (
              <EarningsDashboardScreen
                booking={activeBooking}
                myUserId={user}
              />
            )}
            {effectiveTab === HOST_TABS.PROFILE && (
              <ProfileScreen
                role={effectiveRole}
                booking={activeBooking}
                myUserId={user}
                userProfile={normalizedProfile}
                isKycVerified={Boolean(normalizedProfile?.kycVerified)}
                hasCharger={true}
                onToggleTheme={() => {}}
                onChangeLanguage={setLanguage}
                onOpenKyc={() => {}}
                onOpenNotificationPreferences={() => {}}
                onOpenEditProfile={() => {}}
                onOpenMyChargers={() => setRoleTab('host', HOST_TABS.DASHBOARD)}
                onOpenAvailability={() => setRoleTab('host', HOST_TABS.DASHBOARD)}
                onOpenEarningsDashboard={() => setRoleTab('host', HOST_TABS.EARNINGS)}
                onOpenHelp={() => {}}
                onOpenTerms={() => {}}
                onOpenPrivacy={() => {}}
                onRateApp={() => {}}
                onLogout={logout}
                onDeleteAccount={() => {}}
                onSwitchRole={switchRoleFromProfile}
              />
            )}
          </>
        )}
      </div>

      {/* Role Switcher (Bottom Nav) */}
      <div className="sticky bottom-0 z-20 border-t border-teal-100 dark:border-slate-700/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(246,254,251,0.96))] dark:bg-[linear-gradient(180deg,rgba(14,17,26,0.88),rgba(20,23,32,0.97))] px-2 pb-[env(safe-area-inset-bottom,0px)] pt-2 backdrop-blur-xl md:px-4 md:pb-3">
        <div className="glass-surface flex w-full items-center rounded-[28px] px-1.5 py-1.5 shadow-[0_20px_50px_rgba(13,148,136,0.12)]">
        {effectiveRole === 'user' ? (
          <>
            <button onClick={() => setRoleTab('user', USER_TABS.CHARGE)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === USER_TABS.CHARGE ? 'bg-teal-500/14 text-teal-700 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.2)]' : 'text-slate-500 hover:bg-teal-50 hover:text-slate-700'}`}>⚡ {tx('appShell.charge', 'Charge')}</button>
            <button onClick={() => setRoleTab('user', USER_TABS.DISCOVER)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === USER_TABS.DISCOVER ? 'bg-teal-500/14 text-teal-700 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.2)]' : 'text-slate-500 hover:bg-teal-50 hover:text-slate-700'}`}>🗺️ {tx('appShell.discover', 'Discover')}</button>
            <button onClick={() => setRoleTab('user', USER_TABS.HISTORY)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === USER_TABS.HISTORY ? 'bg-teal-500/14 text-teal-700 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.2)]' : 'text-slate-500 hover:bg-teal-50 hover:text-slate-700'}`}>🕒 {tx('appShell.history', 'History')}</button>
          </>
        ) : (
          <>
            <button onClick={() => setRoleTab('host', HOST_TABS.DASHBOARD)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === HOST_TABS.DASHBOARD ? 'bg-emerald-500/14 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]' : 'text-slate-500 hover:bg-emerald-50 hover:text-slate-700'}`}>🏠 {tx('appShell.dashboard', 'Dashboard')}</button>
            <button onClick={() => setRoleTab('host', HOST_TABS.EARNINGS)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === HOST_TABS.EARNINGS ? 'bg-emerald-500/14 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]' : 'text-slate-500 hover:bg-emerald-50 hover:text-slate-700'}`}>💰 {tx('appShell.earnings', 'Earnings')}</button>
          </>
        )}
        <button onClick={() => setRoleTab(effectiveRole, 'profile')} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === USER_TABS.PROFILE || effectiveTab === HOST_TABS.PROFILE ? 'bg-slate-900/8 text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>👤 {tx('appShell.profile', 'Profile')}</button>
        </div>
      </div>
      
      </div>
    </div>
  );
}