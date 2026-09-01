import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import AuditTimeline from '../features/audit/components/AuditTimeline';
import AuditVerifyBadge from '../features/audit/components/AuditVerifyBadge';
import useAudit from '../features/audit/hooks/useAudit';

const AuditPage = () => {
  const { caseId } = useParams();
  const { entries, verification, loading, verifying, error, fetchAudit, verifyChain } = useAudit(caseId);

  useEffect(() => {
    fetchAudit();
  }, [caseId]);

  const handleVerify = async () => {
    try {
      await verifyChain();
    } catch (err) {
      // Error is handled by useAudit hook
    }
  };

  return (
    <AppShell>
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Link to={`/cases/${caseId}`} className="text-gray-600 hover:text-gray-900">
            ← Back to Case
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
