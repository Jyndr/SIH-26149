import React from 'react';
import Badge from '../../../components/ui/Badge';

const IntegrityBadge = ({ verified, hash }) => {
  if (verified === null) {
    return <Badge variant="default">Not Verified</Badge>;
  }

  if (verified) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="success">✓ Verified</Badge>
        <span className="text-xs text-gray-500 font-mono">{hash?.slice(0, 8)}...</span>
      </div>
    );
  }

  return <Badge variant="danger">✗ Corrupted</Badge>;
};

export default IntegrityBadge;
