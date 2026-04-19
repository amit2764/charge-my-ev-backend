import { create } from 'zustand';

function safeGetItem(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage write failures (private mode/quota/security restrictions).
  }
}

function safeRemoveItem(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
}

function readJson(key, fallback) {
  try {
    const raw = safeGetItem(key);
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
  user: safeGetItem('user') || null,
  role: safeGetItem('role') || 'user', // 'user' or 'host'

  // Quick-login credentials (device-local)
  pinHash: safeGetItem('pinHash') || null,
  biometricCredentialId: safeGetItem('biometricCredentialId') || null,

  // Profiles
  userProfile: readJson('userProfile', null),
  hostProfile: readJson('hostProfile', null),

  // Active states
  activeRequest: readJson('activeRequest', null),
  activeBooking: readJson('activeBooking', null),
  activeBookingRole: safeGetItem('activeBookingRole') || null,

  // Host availability
  isHostAvailable: false,

  // Actions
  setUser: (user) => {
    safeSetItem('user', user);
    set({ user });
  },

  setRole: (role) => {
    safeSetItem('role', role);
    set({ role });
  },

  setPin: async (pin) => {
    const hash = await hashPin(pin);
    safeSetItem('pinHash', hash);
    set({ pinHash: hash });
  },

  verifyPin: async (pin) => {
    const hash = await hashPin(pin);
    return hash === get().pinHash;
  },

  clearPin: () => {
    safeRemoveItem('pinHash');
    safeRemoveItem('biometricCredentialId');
    set({ pinHash: null, biometricCredentialId: null });
  },

  setBiometricCredentialId: (id) => {
    safeSetItem('biometricCredentialId', id);
    set({ biometricCredentialId: id });
  },

  setUserProfile: (profile) => {
    safeSetItem('userProfile', JSON.stringify(profile));
    set({ userProfile: profile });
  },

  setHostProfile: (profile) => {
    safeSetItem('hostProfile', JSON.stringify(profile));
    set({ hostProfile: profile });
  },

  setActiveRequest: (request) => {
    if (request) {
      safeSetItem('activeRequest', JSON.stringify(request));
    } else {
      safeRemoveItem('activeRequest');
    }
    set({ activeRequest: request });
  },

  setActiveBooking: (bookingOrUpdater, ownerRole = null) => {
    const currentBooking = get().activeBooking;
    const nextBooking = typeof bookingOrUpdater === 'function'
      ? bookingOrUpdater(currentBooking)
      : bookingOrUpdater;

    if (nextBooking) {
      safeSetItem('activeBooking', JSON.stringify(nextBooking));
      const resolvedRole = ownerRole || get().activeBookingRole || null;
      if (resolvedRole) {
        safeSetItem('activeBookingRole', resolvedRole);
        set({ activeBooking: nextBooking, activeBookingRole: resolvedRole });
        return;
      }
      set({ activeBooking: nextBooking });
      return;
    }

    safeRemoveItem('activeBooking');
    safeRemoveItem('activeBookingRole');
    set({ activeBooking: null, activeBookingRole: null });
  },

  setIsHostAvailable: (available) => set({ isHostAvailable: available }),

  logout: () => {
    safeRemoveItem('user');
    safeRemoveItem('role');
    safeRemoveItem('userProfile');
    safeRemoveItem('hostProfile');
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
    safeRemoveItem('activeRequest');
    safeRemoveItem('activeBooking');
    safeRemoveItem('activeBookingRole');
  }
}));

// Roles: 'SUPER_ADMIN' | 'OPS_MANAGER' | 'SUPPORT_AGENT'

export const useAdminStore = create((set) => ({
  adminUser: null,
  role: null,
  token: null,

  login: (userData, role, token) => {
    safeSetItem('adminToken', token);
    set({ adminUser: userData, role, token });
  },

  logout: () => {
    safeRemoveItem('adminToken');
    set({ adminUser: null, role: null, token: null });
  }
}));