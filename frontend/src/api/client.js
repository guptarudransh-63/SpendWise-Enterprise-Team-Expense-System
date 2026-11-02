import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor to handle session expirations
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // If unauthorized and not already on login page, can clear state or redirect
      if (window.location.pathname !== '/login') {
        // Soft redirect to login if session expires
      }
    }
    return Promise.reject(error);
  }
);

export default api;
