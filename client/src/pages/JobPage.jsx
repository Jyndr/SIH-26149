import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import JobProgressPanel from '../features/jobs/components/JobProgressPanel';
import RecoveredFileList from '../features/jobs/components/RecoveredFileList';
import useJob from '../features/jobs/hooks/useJob';
import useJobEvents from '../features/jobs/hooks/useJobEvents';
import evidenceApi from '../services/api/evidence.api';
import { formatDate } from '../utils/format';

const JobPage = () => {
  const { caseId, jobId } = useParams();
  const { job, loading, error, setJob } = useJob(jobId);
  const [recoveredFiles, setRecoveredFiles] = useState([]);

  const handleJobUpdate = useCallback((data) => {
    setJob((current) => ({ ...(current || {}), ...data }));
  }, [setJob]);

  useJobEvents(jobId, handleJobUpdate);

  useEffect(() => {
    const loadRecovered = async () => {
      const evidenceId = job?.evidenceId?._id || job?.evidenceId;
      if (!job || job.type !== 'RECOVERY' || job.status !== 'COMPLETED' || !evidenceId) return;
      try {
        const files = await evidenceApi.recoveryResults(String(evidenceId));
        setRecoveredFiles(Array.isArray(files) ? files : job.result?.recoveredFiles || []);
      } catch {
        setRecoveredFiles(job.result?.recoveredFiles || []);
      }
    };
    loadRecovered();
  }, [job?.status, job?.type, job?.evidenceId]);

  if (loading && !job) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error && !job) {
    return (
      <AppShell>
        <div className="py-12 text-center">
          <p className="text-danger-600">{error}</p>
          <Link to={`/cases/${caseId}`} className="mt-4 inline-block text-primary-600 hover:underline">
            Back to case
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!job) {
    return (
      <AppShell>
        <div className="py-12 text-center">
          <p className="text-gray-500">Job not found</p>
          <Link to={`/cases/${caseId}`} className="mt-4 inline-block text-primary-600 hover:underline">
            Back to case
          </Link>
        </div>
      </AppShell>
    );
  }

  const recovered = recoveredFiles.length
    ? recoveredFiles
    : job.result?.recoveredFiles || [];
  const analysisResult = job.type === 'ANALYSIS' ? job.result : job.result?.report;

  return (
    <AppShell>
      <div className="mb-6 flex items-center gap-4">
        <Link to={`/cases/${caseId}`} className="text-gray-600 hover:text-gray-900">
          ← Back to case
        </Link>
        <h1 className="text-2xl font-bold">Job: {job.jobId}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <JobProgressPanel job={job} />

          {job.status === 'COMPLETED' && recovered.length > 0 && (
            <Card className="mt-6">
              <Card.Header>
                <h2 className="text-lg font-semibold">Recovered files</h2>
              </Card.Header>
              <Card.Body>
                <RecoveredFileList files={recovered} />
              </Card.Body>
            </Card>
          )}

          {job.status === 'COMPLETED' && analysisResult && job.type === 'ANALYSIS' && (
            <Card className="mt-6">
              <Card.Header>
                <h2 className="text-lg font-semibold">Analysis report</h2>
              </Card.Header>
              <Card.Body>
                <pre className="overflow-auto rounded-lg bg-gray-50 p-4 text-sm">
                  {JSON.stringify(analysisResult, null, 2)}
                </pre>
              </Card.Body>
            </Card>
          )}
        </div>

        <Card>
          <Card.Header>
            <h2 className="text-lg font-semibold">Job details</h2>
          </Card.Header>
          <Card.Body>
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-gray-600">Job ID</label>
                <p className="font-medium">{job.jobId}</p>
              </div>
              <div>
                <label className="text-gray-600">Type</label>
                <p className="font-medium">{job.type}</p>
              </div>
              <div>
                <label className="text-gray-600">Status</label>
                <p className="font-medium">{job.status}</p>
              </div>
              <div>
                <label className="text-gray-600">Created</label>
                <p className="font-medium">{formatDate(job.createdAt)}</p>
              </div>
              {job.completedAt && (
                <div>
                  <label className="text-gray-600">Completed</label>
                  <p className="font-medium">{formatDate(job.completedAt)}</p>
                </div>
              )}
            </div>
          </Card.Body>
        </Card>
      </div>
    </AppShell>
  );
};

export default JobPage;
