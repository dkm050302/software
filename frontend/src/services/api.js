import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: '/api', // Proxy configured in vite.config.js
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle 401 errors and retry on 502/504
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Retry logic for connection errors (backend starting up)
    // Vite proxy returns 504 Gateway Timeout or 502 Bad Gateway when target is unreachable
    if (error.response && (error.response.status === 504 || error.response.status === 502) && originalRequest) {
      originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
      
      // Retry up to 5 times with 2 second delay
      if (originalRequest._retryCount <= 5) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return api(originalRequest);
      }
    }

    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      // Redirect to login page
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
