import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import evidenceApi from '../../../services/api/evidence.api.js';

export const useEvidence = (caseId) => {
  const [evidence, setEvidence] = useState([]);
  const [current, setCurrent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchEvidence = async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await evidenceApi.list(caseId);
      const list = Array.isArray(data) ? data : [];
      setEvidence(list);
      return list;
    } catch (err) {
      setError(err.message || 'Failed to fetch evidence');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getById = async (evidenceId) => {
    setLoading(true);
    setError(null);
    try {
      const data = await evidenceApi.getById(evidenceId);
      setCurrent(data);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to fetch evidence');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyIntegrity = async (evidenceId) => {
    const data = await evidenceApi.verifyIntegrity(evidenceId);
    setCurrent(data);
    return data;
  };

  const analyze = async (evidenceId) => {
    const result = await evidenceApi.analyze(evidenceId);
    if (result?.jobId) navigate(`/cases/${caseId}/jobs/${result.jobId}`);
    return result;
  };

  const recover = async (evidenceId) => {
    const result = await evidenceApi.recover(evidenceId);
    if (result?.jobId) navigate(`/cases/${caseId}/jobs/${result.jobId}`);
    return result;
  };

  const recoveryResults = async (evidenceId) => evidenceApi.recoveryResults(evidenceId);

  return {
    evidence,
    current,
    loading,
    error,
    fetchEvidence,
    getById,
    verifyIntegrity,
    analyze,
    recover,
    recoveryResults,
    setCurrent,
  };
};

export default useEvidence;
