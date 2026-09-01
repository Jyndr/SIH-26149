import React from 'react';
import Spinner from '../../../components/ui/Spinner';
import CaseCard from './CaseCard';

const CaseList = ({ cases, loading, error }) => {
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

  if (!cases || cases.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No cases found. Create your first case to get started.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cases.map((caseData) => (
        <CaseCard key={caseData._id} case={caseData} />
      ))}
    </div>
  );
};

export default CaseList;
