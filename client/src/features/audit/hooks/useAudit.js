import { useState } from 'react';
import auditApi from '../../../services/api/audit.api.js';

export const useAudit = (caseId) => {
  const [entries, setEntries] = useState([]);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);

  const fetchAudit = async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await auditApi.listForCase(caseId);
      const list = Array.isArray(data) ? data : [];
      setEntries(list);
      return list;
    } catch (err) {
      setError(err.message || 'Failed to load audit log');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyChain = async () => {
    if (!caseId) return;
    setVerifying(true);
    setError(null);
    try {
      const result = await auditApi.verifyChain(caseId);
      setVerification(result);
      return result;
    } catch (err) {
      setError(err.message || 'Failed to verify audit chain');
      throw err;
    } finally {
      setVerifying(false);
    }
  };

  return { entries, verification, loading, verifying, error, fetchAudit, verifyChain };
};

export default useAudit;
