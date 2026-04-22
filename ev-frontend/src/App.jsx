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

function getDefaultTab(role) {
  return DEFAULT_TAB_BY_ROLE[role] || DEFAULT_TAB_BY_ROLE.user;
}

function isValidTab(role, tab) {
  return VALID_TABS_BY_ROLE[role]?.has(tab) ?? false;
}

export default function App() {
  const { user, role, setRole, logout, setUser } = useStore();
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
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#020617]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400/30 border-t-cyan-400" />
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
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-none bg-transparent text-gray-200 md:min-h-screen md:max-w-6xl md:px-4 md:py-5">
      <div className="relative flex min-h-[100dvh] flex-1 flex-col overflow-hidden border border-white/5 bg-[linear-gradient(180deg,rgba(2,6,23,0.92),rgba(15,23,42,0.82))] shadow-[0_30px_80px_rgba(2,6,23,0.45)] md:rounded-[32px]">
      <div className="ambient-orb left-[-90px] top-[-60px] h-48 w-48 bg-blue-500/30" />
      <div className="ambient-orb right-[-80px] top-20 h-40 w-40 bg-emerald-500/20" />
      {foregroundBanner && (
        <div
          role="alert"
          onClick={() => {
            if (foregroundBanner.deepLink) window.location.href = foregroundBanner.deepLink;
            setForegroundBanner(null);
          }}
          className="fixed inset-x-0 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] z-[2000] mx-auto max-w-md cursor-pointer rounded-[24px] border border-blue-400/20 bg-[linear-gradient(135deg,rgba(30,41,59,0.95),rgba(15,23,42,0.92))] px-4 py-3 shadow-[0_20px_50px_rgba(59,130,246,0.18)] backdrop-blur-xl"
        >
          <p className="text-sm font-bold text-cyan-300">{foregroundBanner.title}</p>
          {foregroundBanner.body && <p className="mt-0.5 text-xs text-cyan-200">{foregroundBanner.body}</p>}
        </div>
      )}
      
      {/* Global Mobile Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/5 bg-[linear-gradient(180deg,rgba(2,6,23,0.86),rgba(2,6,23,0.68))] px-3 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.55rem)] backdrop-blur-xl sm:px-4 md:px-5 md:pb-4 md:pt-4">
        <div className="min-w-0 flex-1 px-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Charge My EV</p>
          <h1 className="truncate text-lg font-black text-white sm:text-xl">
            {effectiveRole === 'host' ? 'Host workspace' : 'User workspace'}
          </h1>
        </div>

        <button onClick={logout} className="glass-surface shrink-0 rounded-[18px] px-4 py-2 text-sm font-bold text-red-300 transition hover:border-red-400/30 hover:text-red-200">
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
      <div className="sticky bottom-0 z-20 border-t border-white/5 bg-[linear-gradient(180deg,rgba(2,6,23,0.58),rgba(2,6,23,0.92))] px-2 pb-[env(safe-area-inset-bottom,0px)] pt-2 backdrop-blur-xl md:px-4 md:pb-3">
        <div className="glass-surface flex w-full items-center rounded-[28px] px-1.5 py-1.5 shadow-[0_20px_50px_rgba(2,6,23,0.35)]">
        {effectiveRole === 'user' ? (
          <>
            <button onClick={() => setRoleTab('user', USER_TABS.CHARGE)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === USER_TABS.CHARGE ? 'bg-blue-500/18 text-blue-300 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.24)]' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}>⚡ Charge</button>
            <button onClick={() => setRoleTab('user', USER_TABS.DISCOVER)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === USER_TABS.DISCOVER ? 'bg-blue-500/18 text-blue-300 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.24)]' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}>🗺️ Discover</button>
            <button onClick={() => setRoleTab('user', USER_TABS.HISTORY)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === USER_TABS.HISTORY ? 'bg-blue-500/18 text-blue-300 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.24)]' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}>🕒 History</button>
          </>
        ) : (
          <>
            <button onClick={() => setRoleTab('host', HOST_TABS.DASHBOARD)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === HOST_TABS.DASHBOARD ? 'bg-emerald-500/16 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.2)]' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}>🏠 Dashboard</button>
            <button onClick={() => setRoleTab('host', HOST_TABS.EARNINGS)} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === HOST_TABS.EARNINGS ? 'bg-emerald-500/16 text-emerald-300 shadow-[inset_0_0_0_1px_rgba(34,197,94,0.2)]' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}>💰 Earnings</button>
          </>
        )}
        <button onClick={() => setRoleTab(effectiveRole, 'profile')} className={`min-h-[48px] flex-1 rounded-[20px] px-1 py-3.5 text-center text-[13px] font-bold transition sm:text-sm ${effectiveTab === USER_TABS.PROFILE || effectiveTab === HOST_TABS.PROFILE ? 'bg-white/10 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}>👤 Profile</button>
        </div>
      </div>
      
      </div>
    </div>
  );
}