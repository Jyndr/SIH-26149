import React, { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import AuditTimeline from '../features/audit/components/AuditTimeline';
import AuditVerifyBadge from '../features/audit/components/AuditVerifyBadge';
import useAudit from '../features/audit/hooks/useAudit';

const AuditPage = () => {
  const { caseId } = useParams();
  const { entries, verification, loading, verifying, error, fetchAudit, verifyChain } = useAudit(caseId);

  useEffect(() => {
    fetchAudit();
  }, [caseId]);

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link to={`/cases/${caseId}`} className="text-gray-600 hover:text-gray-900">
            ← Back to case
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Audit trail</h1>
        </div>
        <div className="flex items-center gap-3">
          <AuditVerifyBadge verification={verification} />
          <Button onClick={verifyChain} disabled={verifying}>
            {verifying ? <Spinner size="sm" /> : 'Verify chain'}
          </Button>
        </div>
      </div>
      <AuditTimeline entries={entries} loading={loading} error={error} />
    </AppShell>
  );
};

export default AuditPage;
