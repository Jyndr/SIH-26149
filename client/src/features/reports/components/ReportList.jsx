import React from 'react';
import Button from '../../../components/ui/Button';
import Spinner from '../../../components/ui/Spinner';
import HashCopy from '../../../components/ui/HashCopy';
import { formatDate } from '../../../utils/format';

const ReportList = ({ reports, loading, error, onDownload }) => {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-danger-600 py-12">{error}</p>;
  }

  if (!reports?.length) {
    return <p className="text-center text-gray-500 py-12">No reports generated yet.</p>;
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <div key={report.reportId || report._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <p className="font-semibold text-gray-900">{report.reportId}</p>
            <p className="text-sm text-gray-600">{report.type}</p>
            <p className="text-sm text-gray-500">{formatDate(report.generatedAt)}</p>
            <p className="text-sm text-gray-600">
              SHA-256: <HashCopy value={report.hash} />
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => onDownload(report)}>
            Download
          </Button>
        </div>
      ))}
    </div>
  );
};

export default ReportList;
