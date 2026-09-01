import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import reportsApi from '../../../services/api/reports.api.js';

export const useReports = (caseId) => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchReports = async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await reportsApi.listForCase(caseId);
      const list = Array.isArray(data) ? data : [];
      setReports(list);
      return list;
    } catch (err) {
      setError(err.message || 'Failed to load reports');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const generate = async (type) => {
    setGenerating(true);
    setError(null);
    try {
      const result = await reportsApi.generate(caseId, type);
      if (result?.jobId) {
        navigate(`/cases/${caseId}/jobs/${result.jobId}`);
      }
      return result;
    } catch (err) {
      setError(err.message || 'Failed to generate report');
      throw err;
    } finally {
      setGenerating(false);
    }
  };

  const download = async (report) => {
    await reportsApi.download(report.reportId, `${report.reportId}.json`);
  };

  return { reports, loading, generating, error, fetchReports, generate, download };
};

export default useReports;
