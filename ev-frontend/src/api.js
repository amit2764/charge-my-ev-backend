import axios from 'axios';

// This will automatically use your live Render URL in production,
// and fall back to localhost when you are testing on your computer.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default api;