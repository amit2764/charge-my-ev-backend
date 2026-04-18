import { create } from 'zustand';

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