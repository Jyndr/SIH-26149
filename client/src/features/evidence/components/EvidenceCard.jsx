import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../../components/ui/Card';
import IntegrityBadge from './IntegrityBadge';
import { formatBytes, formatDate, evidenceKey } from '../../../utils/format';

const EvidenceCard = ({ evidence, caseId }) => {
  const id = evidenceKey(evidence);
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <Card.Body>
        <div className="mb-3 flex items-start justify-between gap-2">
          <h3 className="flex-1 truncate text-lg font-semibold text-gray-900">
            {evidence.originalFilename || evidence.evidenceId}
          </h3>
          <IntegrityBadge
            verified={evidence.integrity?.verifiedAt ? evidence.integrity.verified : null}
            hash={evidence.sha256}
          />
        </div>
        <p className="mb-2 text-xs font-mono text-gray-500">{evidence.evidenceId}</p>
        <div className="mb-4 space-y-2 text-sm text-gray-500">
          <div className="flex justify-between">
            <span>Size</span>
            <span>{formatBytes(evidence.size)}</span>
          </div>
          <div className="flex justify-between">
            <span>Type</span>
            <span>{evidence.mimeType || 'Unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span>Analysis</span>
            <span>{evidence.analysisStatus || 'PENDING'}</span>
          </div>
          <div className="flex justify-between">
            <span>Uploaded</span>
            <span>{formatDate(evidence.createdAt)}</span>
          </div>
        </div>
        <Link
          to={`/cases/${caseId}/evidence/${id}`}
          className="block text-center font-medium text-primary-600 hover:text-primary-700"
        >
          View details →
        </Link>
      </Card.Body>
    </Card>
  );
};

export default EvidenceCard;
