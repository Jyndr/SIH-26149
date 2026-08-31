import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import CaseStatusBadge from '../features/cases/components/CaseStatusBadge';
import CaseForm from '../features/cases/components/CaseForm';
import EvidenceList from '../features/evidence/components/EvidenceList';
import EvidenceUploadForm from '../features/evidence/components/EvidenceUploadForm';
import JobStatusBadge from '../features/jobs/components/JobStatusBadge';
import useCase from '../features/cases/hooks/useCase';
import useEvidence from '../features/evidence/hooks/useEvidence';
import jobsApi from '../services/api/jobs.api';
import { formatDate } from '../utils/format';

const CaseDetailPage = () => {
  const { caseId } = useParams();
  const [showEditForm, setShowEditForm] = useState(false);
  const [tab, setTab] = useState('evidence');
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const { caseData, loading, error, fetchCase, updateCase } = useCase(caseId);
  const { evidence, loading: evidenceLoading, error: evidenceError, fetchEvidence } = useEvidence(caseId);

  useEffect(() => {
    fetchCase();
    fetchEvidence();
    const loadJobs = async () => {
      setJobsLoading(true);
      try {
        const list = await jobsApi.list(caseId);
        setJobs(Array.isArray(list) ? list : []);
      } catch {
        setJobs([]);
      } finally {
        setJobsLoading(false);
      }
    };
    loadJobs();
  }, [caseId]);

  const handleUpdateCase = async (formData) => {
    await updateCase(formData);
    setShowEditForm(false);
    await fetchCase();
  };

  if (loading && !caseData) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error && !caseData) {
    return (
      <AppShell>
        <div className="py-12 text-center">
          <p className="text-danger-600">{error}</p>
          <Link to="/cases" className="mt-4 inline-block text-primary-600 hover:underline">
            Back to cases
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!caseData) {
    return (
      <AppShell>
        <div className="py-12 text-center">
          <p className="text-gray-500">Case not found</p>
          <Link to="/cases" className="mt-4 inline-block text-primary-600 hover:underline">
            Back to cases
          </Link>
        </div>
      </AppShell>
    );
  }

  const tabs = [
    { id: 'evidence', label: 'Evidence' },
    { id: 'jobs', label: 'Jobs' },
  ];

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link to="/cases" className="text-gray-600 hover:text-gray-900">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold">{caseData.title}</h1>
          <CaseStatusBadge status={caseData.status} />
        </div>
        <Button variant="secondary" onClick={() => setShowEditForm(!showEditForm)}>
          {showEditForm ? 'Cancel' : 'Edit'}
        </Button>
      </div>

      {showEditForm && (
        <div className="mb-8">
          <CaseForm onSubmit={handleUpdateCase} initialData={caseData} loading={loading} />
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold">Case details</h2>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Case ID</label>
                  <p className="text-gray-900">{caseData.caseId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <p className="whitespace-pre-wrap text-gray-900">
                    {caseData.description || 'No description provided'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Created</label>
                  <p className="text-gray-900">{formatDate(caseData.createdAt)}</p>
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold">Quick actions</h2>
          </Card.Header>
          <Card.Body>
            <div className="space-y-3">
              <Link to={`/cases/${caseId}/sanitize`} className="block w-full rounded-lg bg-warning-600 px-4 py-2 text-center text-white hover:bg-warning-700">
                Sanitization
              </Link>
              <Link to={`/cases/${caseId}/audit`} className="block w-full rounded-lg bg-gray-200 px-4 py-2 text-center text-gray-900 hover:bg-gray-300">
                Audit log
              </Link>
              <Link to={`/cases/${caseId}/reports`} className="block w-full rounded-lg bg-gray-200 px-4 py-2 text-center text-gray-900 hover:bg-gray-300">
                Reports
              </Link>
            </div>
          </Card.Body>
        </Card>
      </div>

      <div className="mb-4 flex gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === item.id ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-800'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'evidence' && (
        <div className="space-y-6">
          <EvidenceUploadForm caseId={caseId} onUploadComplete={fetchEvidence} />
          <EvidenceList evidence={evidence} loading={evidenceLoading} error={evidenceError} caseId={caseId} />
        </div>
      )}

      {tab === 'jobs' && (
        <div className="space-y-3">
          {jobsLoading && <Spinner />}
          {!jobsLoading && jobs.length === 0 && (
            <p className="py-8 text-center text-gray-500">No jobs yet. Analyze or recover evidence to start one.</p>
          )}
          {jobs.map((job) => (
            <Link
              key={job.jobId || job._id}
              to={`/cases/${caseId}/jobs/${job.jobId}`}
              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md"
            >
              <div>
                <p className="font-semibold">{job.jobId}</p>
                <p className="text-sm text-gray-600">{job.type}</p>
              </div>
              <JobStatusBadge status={job.status} />
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
};

export default CaseDetailPage;
