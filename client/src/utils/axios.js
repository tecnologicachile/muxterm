import axios from 'axios';

// Configure axios defaults
axios.defaults.withCredentials = true;

// Set base URL based on environment
if (import.meta.env.DEV) {
  // In development, Vite proxy will handle /api routes
  axios.defaults.baseURL = '';
} else {
  // In production, use relative URLs
  axios.defaults.baseURL = '';
}

// Add request interceptor to add auth token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axios;