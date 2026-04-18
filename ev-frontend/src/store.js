import { create } from 'zustand';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// User Store for EV Frontend
export const useStore = create((set, get) => ({
  // Auth
  user: localStorage.getItem('user') || null,
  role: localStorage.getItem('role') || 'user', // 'user' or 'host'

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