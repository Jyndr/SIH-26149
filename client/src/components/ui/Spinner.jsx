import React from 'react';

const Spinner = ({ size = 'md', className = '', ...props }) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-3',
    xl: 'w-12 h-12 border-4',
  };
  
  return (
    <div
      className={`inline-block rounded-full border-indigo-200 border-t-indigo-600 animate-spin ${sizes[size]} ${className}`}
      {...props}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default Spinner;
