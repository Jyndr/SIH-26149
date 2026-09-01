import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authApi from '../../../services/api/auth.api.js';
import useAuthStore from '../../../store/authStore.js';
import useUIStore from '../../../store/uiStore.js';

export const useAuth = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const saveToStorage = useAuthStore((state) => state.saveToStorage);
  const logoutStore = useAuthStore((state) => state.logout);
  const pushToast = useUIStore((s) => s.pushToast);

  const register = async (data) => {
    setLoading(true);
    setError(null);
    try {
      await authApi.register(data);
      const session = await authApi.login({ email: data.email, password: data.password });
      saveToStorage(session.token, session.user);
      pushToast('success', 'Account created');
      navigate('/cases');
      return session;
    } catch (err) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const login = async (data) => {
    setLoading(true);
    setError(null);
    try {
      const session = await authApi.login(data);
      saveToStorage(session.token, session.user);
      navigate('/cases');
      return session;
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    logoutStore();
    navigate('/login');
  };

  return { register, login, logout, loading, error };
};

export default useAuth;
