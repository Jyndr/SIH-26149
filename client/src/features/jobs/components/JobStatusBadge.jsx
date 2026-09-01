import React from 'react';
import Badge from '../../../components/ui/Badge';

const JobStatusBadge = ({ status }) => {
  const statusMap = {
    QUEUED: { variant: 'default', label: 'Queued' },
    RUNNING: { variant: 'primary', label: 'Running' },
    COMPLETED: { variant: 'success', label: 'Completed' },
    FAILED: { variant: 'danger', label: 'Failed' },
    CANCELLED: { variant: 'default', label: 'Cancelled' },
  };

  const config = statusMap[status] || { variant: 'default', label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
};

export default JobStatusBadge;
