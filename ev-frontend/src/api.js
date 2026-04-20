import axios from 'axios';
import { auth } from './firebase';

// This will automatically use your live Render URL in production,
// but when the app is running on a local machine, it should target the local backend.
const LOCAL_API_URL = 'http://localhost:3000';
const remoteApiUrl = import.meta.env.VITE_API_BASE_URL;
const localHosts = ['localhost', '127.0.0.1', '[::1]'];
const isLocalDev = typeof window !== 'undefined' && (
  localHosts.includes(window.location.hostname) ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.endsWith('.local')
);
const API_BASE_URL = isLocalDev ? LOCAL_API_URL : (remoteApiUrl || window.location.origin);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach Firebase ID token to every request automatically.
// Firebase SDK handles token refresh (tokens expire after 1 hour).
api.interceptors.request.use(async (config) => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    const token = await currentUser.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

export default api;