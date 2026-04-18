import axios from 'axios';

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

export default api;