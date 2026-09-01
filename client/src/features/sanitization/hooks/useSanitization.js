import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import sanitizationApi from '../../../services/api/sanitization.api.js';

export const useSanitization = (caseId) => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const sanitize = async (data) => {
    setLoading(true);
    setError(null);
    try {
      const result = await sanitizationApi.sanitize(caseId, data);
      if (result?.jobId) {
        navigate(`/cases/${caseId}/jobs/${result.jobId}`);
      }
      return result;
    } catch (err) {
      setError(err.message || 'Sanitization failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const listJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await sanitizationApi.listJobs(caseId);
      const list = Array.isArray(data) ? data : [];
      setJobs(list);
      return list;
    } catch (err) {
      setError(err.message || 'Failed to fetch sanitization jobs');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { sanitize, listJobs, jobs, loading, error };
};

export default useSanitization;
