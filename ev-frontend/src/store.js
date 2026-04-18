import { create } from 'zustand';

// User Store for EV Frontend
export const useStore = create((set, get) => ({
  // Auth
  user: localStorage.getItem('user') || null,
  role: localStorage.getItem('role') || 'user', // 'user' or 'host'

  // Profiles
  userProfile: JSON.parse(localStorage.getItem('userProfile')) || null,
  hostProfile: JSON.parse(localStorage.getItem('hostProfile')) || null,

  // Active states
  activeRequest: null,
  activeBooking: null,

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

  setActiveRequest: (request) => set({ activeRequest: request }),

  setActiveBooking: (booking) => set({ activeBooking: booking }),

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
      isHostAvailable: false
    });
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