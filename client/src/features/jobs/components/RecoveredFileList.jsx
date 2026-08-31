import React from 'react';
import Spinner from '../../../components/ui/Spinner';
import RecoveredFileCard from './RecoveredFileCard';

const RecoveredFileList = ({ files, loading }) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Spinner size="sm" />
      </div>
    );
  }

  if (!files || files.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">No recovered files</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {files.map((file, index) => (
        <RecoveredFileCard key={index} file={file} />
      ))}
    </div>
  );
};

export default RecoveredFileList;
