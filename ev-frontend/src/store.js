import { create } from 'zustand';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'ev_charge_pin_v1');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// User Store for EV Frontend
export const useStore = create((set, get) => ({
  // Auth
  user: localStorage.getItem('user') || null,
  role: localStorage.getItem('role') || 'user', // 'user' or 'host'

  // Quick-login credentials (device-local)
  pinHash: localStorage.getItem('pinHash') || null,
  biometricCredentialId: localStorage.getItem('biometricCredentialId') || null,

  // Profiles
  userProfile: readJson('userProfile', null),
  hostProfile: readJson('hostProfile', null),

  // Active states
  activeRequest: readJson('activeRequest', null),
  activeBooking: readJson('activeBooking', null),
  activeBookingRole: localStorage.getItem('activeBookingRole') || null,

  // Host availability
  isHostAvailable: false,

  // Actions
  setUser: (user) => {
    localStorage.setItem('user', user);
    set({ user });
  },

  setRole: (role) => {
    localStorage.setItem('role', role);
    set({ role });
  },

  setPin: async (pin) => {
    const hash = await hashPin(pin);
    localStorage.setItem('pinHash', hash);
    set({ pinHash: hash });
  },

  verifyPin: async (pin) => {
    const hash = await hashPin(pin);
    return hash === get().pinHash;
  },

  clearPin: () => {
    localStorage.removeItem('pinHash');
    localStorage.removeItem('biometricCredentialId');
    set({ pinHash: null, biometricCredentialId: null });
  },

  setBiometricCredentialId: (id) => {
    localStorage.setItem('biometricCredentialId', id);
    set({ biometricCredentialId: id });
  },

  setUserProfile: (profile) => {
    localStorage.setItem('userProfile', JSON.stringify(profile));
    set({ userProfile: profile });
  },

  setHostProfile: (profile) => {
    localStorage.setItem('hostProfile', JSON.stringify(profile));
    set({ hostProfile: profile });
  },

  setActiveRequest: (request) => {
    if (request) {
      localStorage.setItem('activeRequest', JSON.stringify(request));
    } else {
      localStorage.removeItem('activeRequest');
    }
    set({ activeRequest: request });
  },

  setActiveBooking: (bookingOrUpdater, ownerRole = null) => {
    const currentBooking = get().activeBooking;
    const nextBooking = typeof bookingOrUpdater === 'function'
      ? bookingOrUpdater(currentBooking)
      : bookingOrUpdater;

    if (nextBooking) {
      localStorage.setItem('activeBooking', JSON.stringify(nextBooking));
      const resolvedRole = ownerRole || get().activeBookingRole || null;
      if (resolvedRole) {
        localStorage.setItem('activeBookingRole', resolvedRole);
        set({ activeBooking: nextBooking, activeBookingRole: resolvedRole });
        return;
      }
      set({ activeBooking: nextBooking });
      return;
    }

    localStorage.removeItem('activeBooking');
    localStorage.removeItem('activeBookingRole');
    set({ activeBooking: null, activeBookingRole: null });
  },

  setIsHostAvailable: (available) => set({ isHostAvailable: available }),

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('role');
    localStorage.removeItem('userProfile');
    localStorage.removeItem('hostProfile');
    // Keep PIN and biometric on logout so quick-login works on next open
    set({
      user: null,
      role: 'user',
      userProfile: null,
      hostProfile: null,
      activeRequest: null,
      activeBooking: null,
      activeBookingRole: null,
      isHostAvailable: false
    });
    localStorage.removeItem('activeRequest');
    localStorage.removeItem('activeBooking');
    localStorage.removeItem('activeBookingRole');
  }
}));

// Roles: 'SUPER_ADMIN' | 'OPS_MANAGER' | 'SUPPORT_AGENT'

export const useAdminStore = create((set) => ({
  adminUser: null,
  role: null,
  token: null,

  login: (userData, role, token) => {
    localStorage.setItem('adminToken', token);
    set({ adminUser: userData, role, token });
  },

  logout: () => {
    localStorage.removeItem('adminToken');
    set({ adminUser: null, role: null, token: null });
  }
}));