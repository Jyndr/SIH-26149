import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import SanitizeForm from '../features/sanitization/components/SanitizeForm';
import SanitizationJobList from '../features/sanitization/components/SanitizationJobList';
import useSanitization from '../features/sanitization/hooks/useSanitization';

const SanitizationPage = () => {
  const { caseId } = useParams();
  const [jobs, setJobs] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const { sanitize, listJobs, loading } = useSanitization(caseId);

  useEffect(() => {
    loadJobs();
  }, [caseId]);

  const loadJobs = async () => {
    try {
      const response = await listJobs();
      setJobs(response.data || []);
    } catch (err) {
      console.error('Failed to load jobs:', err);
    }
  };

  const handleSanitize = async (formData) => {
    try {
      await sanitize(formData);
      setShowForm(false);
      await loadJobs();
    } catch (err) {
      // Error is handled by useSanitization hook
    }
  };

  return (
    <AppShell>
      <Link to={`/cases/${caseId}`} className="text-gray-600 hover:text-gray-900">
        ← Back to case
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">Sanitization</h1>
      {error && <p className="mb-4 text-danger-600">{error}</p>}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SanitizeForm onSubmit={sanitize} loading={loading} />
        <div>
          <h2 className="mb-3 text-lg font-semibold">Past jobs</h2>
          <SanitizationJobList jobs={jobs} loading={loading} caseId={caseId} />
        </div>
      </div>
    </AppShell>
  );
};

export default SanitizationPage;
