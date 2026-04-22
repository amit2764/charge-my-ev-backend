import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { useStore } from './store';
import { initFCM, onForegroundMessage } from './utils/fcm';
import LoginScreen from './LoginScreen';
import UserFlow from './UserFlow';
import UserProfile from './UserProfile';
import UserHistory from './UserHistory';
import HostEarnings from './HostEarnings';
import HostFlow from './HostFlow';
import PINSetup from './components/PINSetup';
import PINUnlock from './components/PINUnlock';
import DiscoveryMapScreen from './screens/DiscoveryMapScreen';
import { DEFAULT_TAB_BY_ROLE, VALID_TABS_BY_ROLE, USER_TABS, HOST_TABS } from './navigation';
import { useThemeStore } from './hooks/useTheme';

function getDefaultTab(role) {
  return DEFAULT_TAB_BY_ROLE[role] || DEFAULT_TAB_BY_ROLE.user;
}

function isValidTab(role, tab) {
  return VALID_TABS_BY_ROLE[role]?.has(tab) ?? false;
}

export default function App() {
  const { user, role, setRole, logout, setUser } = useStore();
  const { isDark } = useThemeStore();
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [tabsByRole, setTabsByRole] = useState({
    user: DEFAULT_TAB_BY_ROLE.user,
    host: DEFAULT_TAB_BY_ROLE.host
  });
  const [foregroundBanner, setForegroundBanner] = useState(null);

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
          className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] z-[2000] mx-auto max-w-md cursor-pointer rounded-[24px] border border-teal-200 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,253,250,0.95))] px-4 py-3 shadow-[0_20px_50px_rgba(13,148,136,0.14)] backdrop-blur-xl"
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
            {effectiveRole === 'host' ? 'Host workspace' : 'User workspace'}
          </h1>
        </div>

        <button onClick={logout} className="glass-surface shrink-0 rounded-[18px] px-4 py-2 text-sm font-bold text-rose-600 transition hover:border-rose-200 hover:text-rose-700">
          Logout
        </button>
      </header>

      {/* Dynamic Screen Content */}
      <div className="scrollbar-hide flex-1 overflow-y-auto overscroll-contain pb-[calc(6.5rem+env(safe-area-inset-bottom,0px))] md:px-1">
        {effectiveRole === 'user' ? (
          <>
            {effectiveTab === USER_TABS.CHARGE && <UserFlow />}
            {effectiveTab === USER_TABS.DISCOVER && (
              <DiscoveryMapScreen
                onRequestCharge={(host) => {
                  void host;
                  setRoleTab('user', USER_TABS.CHARGE);
                }}
              />
            )}
            {effectiveTab === USER_TABS.HISTORY && <UserHistory />}
            {effectiveTab === USER_TABS.PROFILE && <UserProfile onSwitchRole={switchRoleFromProfile} />}
          </>
        ) : (
          <>
            {effectiveTab === HOST_TABS.DASHBOARD && <HostFlow />}
            {effectiveTab === HOST_TABS.EARNINGS && <HostEarnings />}
            {effectiveTab === HOST_TABS.PROFILE && <UserProfile onSwitchRole={switchRoleFromProfile} />}
          </>
        )}
      </div>

      {/* Role Switcher (Bottom Nav) */}
      <div className="sticky bottom-0 z-20 border-t border-teal-100 dark:border-slate-700/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(246,254,251,0.96))] dark:bg-[linear-gradient(180deg,rgba(14,17,26,0.88),rgba(20,23,32,0.97))] px-2 pb-[env(safe-area-inset-bottom,0px)] pt-2 backdrop-blur-xl md:px-4 md:pb-3">
        <div className="glass-surface flex w-full items-center rounded-[28px] px-1.5 py-1.5 shadow-[0_20px_50px_rgba(13,148,136,0.12)]">
        {effectiveRole === 'user' ? (
          <>
            <button onClick={() => setRoleTab('user', USER_TABS.CHARGE)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === USER_TABS.CHARGE ? 'bg-teal-500/14 text-teal-700 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.2)]' : 'text-slate-500 hover:bg-teal-50 hover:text-slate-700'}`}>⚡ Charge</button>
            <button onClick={() => setRoleTab('user', USER_TABS.DISCOVER)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === USER_TABS.DISCOVER ? 'bg-teal-500/14 text-teal-700 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.2)]' : 'text-slate-500 hover:bg-teal-50 hover:text-slate-700'}`}>🗺️ Discover</button>
            <button onClick={() => setRoleTab('user', USER_TABS.HISTORY)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === USER_TABS.HISTORY ? 'bg-teal-500/14 text-teal-700 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.2)]' : 'text-slate-500 hover:bg-teal-50 hover:text-slate-700'}`}>🕒 History</button>
          </>
        ) : (
          <>
            <button onClick={() => setRoleTab('host', HOST_TABS.DASHBOARD)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === HOST_TABS.DASHBOARD ? 'bg-emerald-500/14 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]' : 'text-slate-500 hover:bg-emerald-50 hover:text-slate-700'}`}>🏠 Dashboard</button>
            <button onClick={() => setRoleTab('host', HOST_TABS.EARNINGS)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === HOST_TABS.EARNINGS ? 'bg-emerald-500/14 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.2)]' : 'text-slate-500 hover:bg-emerald-50 hover:text-slate-700'}`}>💰 Earnings</button>
          </>
        )}
        <button onClick={() => setRoleTab(effectiveRole, 'profile')} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === USER_TABS.PROFILE || effectiveTab === HOST_TABS.PROFILE ? 'bg-slate-900/8 text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}>👤 Profile</button>
        </div>
      </div>
      
      </div>
    </div>
  );
}