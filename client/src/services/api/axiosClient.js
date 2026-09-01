import axios from 'axios';
import { API_BASE_URL } from '../../config/env.js';
import useAuthStore from '../../store/authStore.js';
import useUIStore from '../../store/uiStore.js';

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
});

axiosClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => Promise.reject(error)
);

axiosClient.interceptors.response.use(
  (response) => (response.config.responseType === 'blob' ? response : response.data),
  (error) => {
    const apiError = error.response?.data?.error;
    const message = apiError?.message || error.message || 'Something went wrong. Please try again.';
    const url = error.config?.url || '';
    const isAuthForm = url.includes('/auth/login') || url.includes('/auth/register');

    if (error.response?.status === 401 && !isAuthForm) {
      useAuthStore.getState().logout();
    }

    useUIStore.getState().pushToast('error', message);
    return Promise.reject(apiError || error);
  }
);

export default axiosClient;
