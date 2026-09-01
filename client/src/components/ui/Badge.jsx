import React from 'react';

const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-gray-100 text-gray-800 border border-gray-200',
    primary: 'bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-200',
    success: 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 border border-green-200',
    danger: 'bg-gradient-to-r from-red-50 to-rose-50 text-red-700 border border-red-200',
    warning: 'bg-gradient-to-r from-amber-50 to-yellow-50 text-amber-700 border border-amber-200',
    info: 'bg-gradient-to-r from-cyan-50 to-sky-50 text-cyan-700 border border-cyan-200',
  };
  
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shadow-sm ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
