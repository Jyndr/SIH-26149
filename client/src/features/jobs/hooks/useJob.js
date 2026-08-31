import { useState, useEffect } from 'react';
import jobsApi from '../../../services/api/jobs.api.js';

export const useJob = (jobId) => {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchJob = async () => {
    if (!jobId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await jobsApi.getById(jobId);
      setJob(data);
      return data;
    } catch (err) {
      setError(err.message || 'Failed to fetch job');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  return { job, loading, error, fetchJob, setJob };
};

export default useJob;
