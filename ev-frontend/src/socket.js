import { io } from 'socket.io-client';

const LOCAL_API_URL = 'http://localhost:3000';
const remoteApiUrl = import.meta.env.VITE_API_BASE_URL;
const localHosts = ['localhost', '127.0.0.1', '[::1]'];
const isLocalDev = typeof window !== 'undefined' && (
  localHosts.includes(window.location.hostname) ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.endsWith('.local')
);
const SOCKET_URL = isLocalDev ? LOCAL_API_URL : (remoteApiUrl || window.location.origin);

// Set up the Socket.io client
export const socket = io(SOCKET_URL, {
  path: '/ws',
  autoConnect: false, // We'll connect it manually when the Dashboard loads
});