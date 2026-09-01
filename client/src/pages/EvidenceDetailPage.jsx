import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Spinner from '../components/ui/Spinner';
import HashCopy from '../components/ui/HashCopy';
import IntegrityBadge from '../features/evidence/components/IntegrityBadge';
import RecoveredFileList from '../features/jobs/components/RecoveredFileList';
import useEvidence from '../features/evidence/hooks/useEvidence';
import { formatBytes, formatDate } from '../utils/format';

const EvidenceDetailPage = () => {
  const { caseId, evidenceId } = useParams();
  const {
    current: evidenceData,
    loading,
    error,
    getById,
    verifyIntegrity,
    analyze,
    recover,
    recoveryResults,
  } = useEvidence(caseId);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [recoveredFiles, setRecoveredFiles] = useState([]);

  useEffect(() => {
    getById(evidenceId);
  }, [caseId, evidenceId]);

  useEffect(() => {
    const loadRecovered = async () => {
      try {
        const files = await recoveryResults(evidenceId);
        setRecoveredFiles(Array.isArray(files) ? files : []);
      } catch {
        setRecoveredFiles([]);
      }
    };
    loadRecovered();
  }, [evidenceId]);

  const handleVerifyIntegrity = async () => {
    setVerifyLoading(true);
    try {
      await verifyIntegrity(evidenceId);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleAnalyze = async () => {
    setActionLoading('analyze');
    try {
      await analyze(evidenceId);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecover = async () => {
    setActionLoading('recover');
    try {
      await recover(evidenceId);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && !evidenceData) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error && !evidenceData) {
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

  if (!evidenceData) {
    return (
      <AppShell>
        <div className="py-12 text-center">
          <p className="text-gray-500">Evidence not found</p>
          <Link to={`/cases/${caseId}`} className="mt-4 inline-block text-primary-600 hover:underline">
            Back to case
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <Link to={`/cases/${caseId}`} className="text-gray-600 hover:text-gray-900">
            ← Back to case
          </Link>
          <h1 className="text-2xl font-bold">{evidenceData.originalFilename || evidenceData.evidenceId}</h1>
          <IntegrityBadge
            verified={evidenceData.integrity?.verifiedAt ? evidenceData.integrity.verified : null}
            hash={evidenceData.sha256}
          />
        </div>
        <Button onClick={handleVerifyIntegrity} disabled={verifyLoading}>
          {verifyLoading ? 'Verifying...' : 'Verify integrity'}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold">Evidence details</h2>
            </Card.Header>
            <Card.Body>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Evidence ID</label>
                  <p className="text-gray-900">{evidenceData.evidenceId}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">File size</label>
                  <p className="text-gray-900">{formatBytes(evidenceData.size)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">MIME type</label>
                  <p className="text-gray-900">{evidenceData.mimeType || 'Unknown'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Analysis status</label>
                  <p className="text-gray-900">{evidenceData.analysisStatus}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">SHA-256</label>
                  <p className="break-all font-mono text-sm text-gray-900">
                    {evidenceData.sha256} <HashCopy value={evidenceData.sha256} />
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Uploaded</label>
                  <p className="text-gray-900">{formatDate(evidenceData.createdAt)}</p>
                </div>
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold">Recovered files</h2>
            </Card.Header>
            <Card.Body>
              <RecoveredFileList files={recoveredFiles} />
            </Card.Body>
          </Card>
        </div>

        <div>
          <Card>
            <Card.Header>
              <h2 className="text-lg font-semibold">Actions</h2>
            </Card.Header>
            <Card.Body>
              <div className="space-y-3">
                <Button variant="primary" className="w-full" onClick={handleAnalyze} disabled={!!actionLoading}>
                  {actionLoading === 'analyze' ? 'Starting…' : 'Analyze evidence'}
                </Button>
                <Button variant="success" className="w-full" onClick={handleRecover} disabled={!!actionLoading}>
                  {actionLoading === 'recover' ? 'Starting…' : 'Recover files'}
                </Button>
                <Link
                  to={`/cases/${caseId}`}
                  className="block w-full rounded-lg bg-gray-200 px-4 py-2 text-center text-gray-900 hover:bg-gray-300"
                >
                  Back to case
                </Link>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </AppShell>
  );
};

export default EvidenceDetailPage;
