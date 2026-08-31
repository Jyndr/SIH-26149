import React from 'react';
import Spinner from '../../../components/ui/Spinner';
import HashCopy from '../../../components/ui/HashCopy';
import { formatDate } from '../../../utils/format';

const actorLabel = (actor) => {
  if (!actor) return 'Unknown';
  if (typeof actor === 'string') return actor;
  return actor.name || actor.email || actor.userId || 'Unknown';
};

const AuditTimeline = ({ entries, loading, error }) => {
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

  if (!entries?.length) {
    return <p className="text-center text-gray-500 py-12">No audit events for this case yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry) => (
        <li key={entry.auditId || entry._id} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-gray-900">{entry.operation}</p>
              <p className="text-sm text-gray-600">{entry.target}</p>
            </div>
            <span
              className={`text-xs font-medium ${
                entry.result === 'FAILURE' ? 'text-danger-700' : 'text-success-700'
              }`}
            >
              {entry.result}
            </span>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
            <p>Actor: {actorLabel(entry.actor)}</p>
            <p>{formatDate(entry.timestamp)}</p>
            <p className="sm:col-span-2">
              Record hash: <HashCopy value={entry.recordHash} />
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
};

export default AuditTimeline;
