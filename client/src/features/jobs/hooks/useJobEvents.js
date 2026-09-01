import { useCallback } from 'react';
import useSSE from '../../../hooks/useSSE.js';

export const useJobEvents = (jobId, onJobUpdate) => {
  const handleJobUpdate = useCallback((data) => {
    onJobUpdate?.(data);
  }, [onJobUpdate]);

  return useSSE(`/jobs/${jobId}/events`, handleJobUpdate, !!jobId);
};

export default useJobEvents;
