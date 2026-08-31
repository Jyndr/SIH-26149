import React from 'react';
import Badge from '../../../components/ui/Badge';

const AuditVerifyBadge = ({ verification }) => {
  if (!verification) {
    return <Badge variant="default">Not verified</Badge>;
  }

  if (verification.valid) {
    return (
      <Badge variant="success">
        Chain intact · {verification.checkedEntries} entries
      </Badge>
    );
  }

  return (
    <Badge variant="danger">
      Tampered at {verification.brokenAt || 'unknown'}
    </Badge>
  );
};

export default AuditVerifyBadge;
