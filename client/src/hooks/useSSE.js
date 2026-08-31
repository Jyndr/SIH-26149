import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/env.js';
import useAuthStore from '../store/authStore.js';

export const useSSE = (endpoint, onMessage, enabled = true) => {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!enabled || !endpoint) return undefined;

    const url = `${API_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${encodeURIComponent(token || '')}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onerror = () => {
      setConnected(false);
      setError('Connection lost');
    };

    const handleMessage = (event) => {
      try {
        onMessage(JSON.parse(event.data));
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onmessage = handleMessage;
    eventSource.addEventListener('progress', handleMessage);
    eventSource.addEventListener('completed', handleMessage);
    eventSource.addEventListener('failed', handleMessage);

    return () => eventSource.close();
  }, [endpoint, onMessage, enabled, token]);

  return { connected, error };
};

export default useSSE;
