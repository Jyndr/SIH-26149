import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ForensicExplorer } from '../components/forensic/ForensicExplorer';

export const ForensicExplorerPage = () => {
  const { caseId, evidenceId } = useParams();
  const navigate = useNavigate();

  return (
    <div className="max-w-7xl mx-auto">
      <ForensicExplorer
        evidenceId={evidenceId}
        caseId={caseId}
        onBack={() => navigate(`/cases/${caseId}`)}
      />
    </div>
  );
};
