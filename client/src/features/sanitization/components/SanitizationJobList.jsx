import React from 'react';
import { Link } from 'react-router-dom';
import Spinner from '../../../components/ui/Spinner';
import JobStatusBadge from '../../jobs/components/JobStatusBadge';
import { formatDate } from '../../../utils/format';

const SanitizationJobList = ({ jobs, loading, caseId }) => {
  if (loading && !jobs?.length) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="sm" />
      </div>
    );
  }

  if (!jobs?.length) {
    return <p className="text-center text-sm text-gray-500 py-8">No sanitization jobs yet.</p>;
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const genericJobId = job.jobId?.jobId || job.job?.jobId;
        const status = job.status || job.jobId?.status;
        return (
          <div key={job.sanitizationId || job._id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900">{job.sanitizationId}</h3>
                  <JobStatusBadge status={status} />
                </div>
                <p className="text-sm text-gray-600">Target: {job.target}</p>
                <p className="text-sm text-gray-600">
                  {job.targetType} · {job.method}
                </p>
                <p className="text-sm text-gray-500">{formatDate(job.createdAt)}</p>
                {job.verification && (
                  <p className="mt-1 text-sm">
                    Verification:{' '}
                    <span className={job.verification.passed ? 'text-success-700' : 'text-danger-700'}>
                      {job.verification.passed ? 'passed' : 'failed'}
                    </span>
                  </p>
                )}
              </div>
              {genericJobId && (
                <Link
                  to={`/cases/${caseId}/jobs/${genericJobId}`}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  View job →
                </Link>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SanitizationJobList;
