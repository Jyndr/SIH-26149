import { useState } from 'react';
import casesApi from '../../../services/api/cases.api.js';
import useCaseStore from '../../../store/caseStore.js';

export const useCase = (caseId) => {
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const setCurrentCase = useCaseStore((state) => state.setCurrentCase);

  const fetchCase = async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await casesApi.getById(caseId);
      setCaseData(data);
      setCurrentCase(data);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to fetch case');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateCase = async (payload) => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await casesApi.update(caseId, payload);
      setCaseData(data);
      setCurrentCase(data);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to update case');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { caseData, loading, error, fetchCase, updateCase };
};

export default useCase;
