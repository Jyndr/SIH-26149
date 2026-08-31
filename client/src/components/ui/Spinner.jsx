import React from 'react';

const Spinner = ({ size = 'md', className = '', ...props }) => {
  const sizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };
  
  return (
    <div
      className={`inline-block animate-spin rounded-full border-2 border-gray-300 border-t-primary-600 ${sizes[size]} ${className}`}
      {...props}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default Spinner;
