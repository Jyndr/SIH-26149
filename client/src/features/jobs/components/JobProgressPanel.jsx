import React from 'react';
import Card from '../../../components/ui/Card';
import JobStatusBadge from './JobStatusBadge';

const JobProgressPanel = ({ job }) => {
  if (!job) return null;

  const progress = job.progress || 0;
  const stage = job.stage || job.status?.toLowerCase() || 'processing';
  const error = job.error;

  return (
    <Card>
      <Card.Header>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Job progress</h2>
          <JobStatusBadge status={job.status} />
        </div>
      </Card.Header>
      <Card.Body>
        <div className="space-y-4">
          <div>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-gray-600">Stage</span>
              <span className="font-medium">{stage}</span>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-200">
              <div
                className="h-3 rounded-full bg-primary-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-gray-500">Progress</span>
              <span className="font-medium">{progress}%</span>
            </div>
          </div>

          {error?.message && (
            <div className="rounded-lg border border-danger-200 bg-danger-50 p-3">
              <p className="text-sm font-medium text-danger-800">Error</p>
              <p className="mt-1 text-sm text-danger-700">{error.message}</p>
            </div>
          )}

          {job.status === 'COMPLETED' && (
            <div className="rounded-lg border border-success-200 bg-success-50 p-3">
              <p className="text-sm font-medium text-success-800">Completed successfully</p>
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
};

export default JobProgressPanel;
