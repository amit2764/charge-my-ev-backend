import { create } from 'zustand';

function safeGetItem(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    if (value === 'null' || value === 'undefined' || value === '') return fallback;
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
  // Session is always explicit per app launch. We keep only a remembered user id
  // for quick PIN/biometric unlock, not an always-on signed-in session.
  user: null,
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
  bookingStep: safeGetItem('bookingStep') || 'REQUEST',

  // Host availability
  isHostAvailable: false,

  // Actions
  setUser: (user) => {
    const normalizedUser = (typeof user === 'string' ? user.trim() : user) || null;
    if (!normalizedUser || normalizedUser === 'null' || normalizedUser === 'undefined') {
      safeRemoveItem('user');
      set({ user: null });
      return;
    }

    safeSetItem('user', normalizedUser);
    safeSetItem('authUser', normalizedUser);
    set({ user: normalizedUser });
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
    safeRemoveItem('authUser');
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
    safeSetItem('bookingStep', 'REQUEST');
    set({ activeBooking: null, activeBookingRole: null, bookingStep: 'REQUEST' });
  },

  setBookingStep: (step) => {
    const nextStep = step || 'REQUEST';
    safeSetItem('bookingStep', nextStep);
    set({ bookingStep: nextStep });
  },

  setIsHostAvailable: (available) => set({ isHostAvailable: available }),

  logout: () => {
    safeRemoveItem('user');
    safeRemoveItem('role');
    safeRemoveItem('userProfile');
    safeRemoveItem('hostProfile');
    // Keep remembered user id only when quick unlock exists.
    const hasQuickUnlock = !!get().pinHash || !!get().biometricCredentialId;
    if (!hasQuickUnlock) {
      safeRemoveItem('authUser');
    }

    set({
      user: null,
      role: 'user',
      userProfile: null,
      hostProfile: null,
      activeRequest: null,
      activeBooking: null,
      activeBookingRole: null,
      bookingStep: 'REQUEST',
      isHostAvailable: false
    });
    safeRemoveItem('activeRequest');
    safeRemoveItem('activeBooking');
    safeRemoveItem('activeBookingRole');
    safeSetItem('bookingStep', 'REQUEST');
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