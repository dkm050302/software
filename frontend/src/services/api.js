import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: '/api', // Proxy configured in vite.config.js
  headers: {
    'Content-Type': 'application/json',
  },
});

// 检查token是否即将过期（在5分钟内过期）
const isTokenExpiringSoon = (token) => {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp * 1000; // 转换为毫秒
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    return exp - now < fiveMinutes;
  } catch (e) {
    return false;
  }
};

// 刷新token（使用原始axios实例避免循环调用）
let isRefreshing = false;
let refreshPromise = null;

const refreshToken = async () => {
  // 如果正在刷新，返回同一个promise
  if (isRefreshing) {
    return refreshPromise;
  }
  
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const currentToken = sessionStorage.getItem("token");
      if (!currentToken) {
        throw new Error("No token to refresh");
      }
      
      // 使用原始axios实例，避免拦截器循环
      const axiosInstance = axios.create({
        baseURL: '/api',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`
        }
      });
      
      const response = await axiosInstance.post("/auth/refresh");
      const newToken = response.data.access_token;
      sessionStorage.setItem("token", newToken);
      return newToken;
    } catch (error) {
      // 刷新失败，清除token并跳转到登录页
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("studentId");
      window.location.href = "/login";
      throw error;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
};

// Add a request interceptor to include the auth token and auto-refresh
api.interceptors.request.use(
  async (config) => {
    let token = sessionStorage.getItem("token");
    
    // 如果token存在且即将过期，尝试刷新
    if (token && isTokenExpiringSoon(token)) {
      try {
        token = await refreshToken();
      } catch (error) {
        // 刷新失败，请求会被取消
        return Promise.reject(error);
      }
    }
    
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

    // 处理401错误：尝试刷新token后重试
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // 尝试刷新token
        const newToken = await refreshToken();
        // 使用新token重试请求
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // 刷新失败，清除token并跳转到登录页
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("studentId");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
