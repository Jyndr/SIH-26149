import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import ReportGenerateButton from '../features/reports/components/ReportGenerateButton';
import ReportList from '../features/reports/components/ReportList';
import useReports from '../features/reports/hooks/useReports';

const ReportsPage = () => {
  const { caseId } = useParams();
  const { reports, loading, generating, error, fetchReports, generate } = useReports(caseId);

  useEffect(() => {
    fetchReports();
  }, [caseId]);

  const handleGenerate = async (type) => {
    try {
      await generate(type);
      await fetchReports();
    } catch (err) {
      // Error is handled by useReports hook
    }
  };

  return (
    <AppShell>
      <Link to={`/cases/${caseId}`} className="text-gray-600 hover:text-gray-900">
        ← Back to case
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-bold">Reports</h1>
      <Card className="mb-6">
        <Card.Body>
          <ReportGenerateButton onGenerate={generate} loading={generating} />
        </Card.Body>
      </Card>
      <ReportList reports={reports} loading={loading} error={error} onDownload={download} />
    </AppShell>
  );
};

export default ReportsPage;
