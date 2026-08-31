import React from 'react';

const ProgressBar = ({ value = 0, label }) => {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div>
      {label && (
        <div className="mb-1 flex justify-between text-sm text-gray-600">
          <span>{label}</span>
          <span>{pct}%</span>
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-gray-200">
        <div className="h-2 rounded-full bg-primary-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default ProgressBar;
