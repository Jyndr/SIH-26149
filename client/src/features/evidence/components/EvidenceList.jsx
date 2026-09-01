import React from 'react';
import Spinner from '../../../components/ui/Spinner';
import EvidenceCard from './EvidenceCard';

const EvidenceList = ({ evidence, loading, error, caseId }) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-danger-600">{error}</p>
      </div>
    );
  }

  if (!evidence || evidence.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No evidence uploaded yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {evidence.map((ev) => (
        <EvidenceCard key={ev._id} evidence={ev} caseId={caseId} />
      ))}
    </div>
  );
};

export default EvidenceList;
