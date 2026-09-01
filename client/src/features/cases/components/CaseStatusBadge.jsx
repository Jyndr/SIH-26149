import React from 'react';
import Badge from '../../../components/ui/Badge';

const CaseStatusBadge = ({ status }) => {
  const statusMap = {
    OPEN: { variant: 'success', label: 'Open' },
    IN_PROGRESS: { variant: 'primary', label: 'In Progress' },
    CLOSED: { variant: 'default', label: 'Closed' },
    ARCHIVED: { variant: 'warning', label: 'Archived' },
  };

  const config = statusMap[status] || { variant: 'default', label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export default CaseStatusBadge;
