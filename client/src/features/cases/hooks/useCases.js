import { useState } from 'react';
import casesApi from '../../../services/api/cases.api.js';

export const useCases = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCases = async (params = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await casesApi.list(params);
      const list = Array.isArray(data) ? data : data?.cases || [];
      setCases(list);
      return list;
    } catch (err) {
      setError(err.message || 'Failed to fetch cases');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createCase = async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const created = await casesApi.create(payload);
      setCases((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      setError(err.message || 'Failed to create case');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { cases, loading, error, fetchCases, createCase };
};

export default useCases;
