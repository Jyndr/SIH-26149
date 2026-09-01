import { useState } from 'react';
import evidenceApi from '../../../services/api/evidence.api.js';

export const useEvidenceUpload = (caseId) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const uploadEvidence = async (file) => {
    setLoading(true);
    setError(null);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const created = await evidenceApi.upload(caseId, formData, (progressEvent) => {
        if (!progressEvent.total) return;
        setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
      });
      setUploadProgress(100);
      return created;
    } catch (err) {
      setError(err.message || 'Failed to upload evidence');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { uploadEvidence, uploadProgress, loading, error };
};

export default useEvidenceUpload;
