import React, { useEffect } from 'react';

const Toast = ({ message, type = 'info', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const types = {
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-success-50 border-success-200 text-success-800',
    warning: 'bg-warning-50 border-warning-200 text-warning-800',
    error: 'bg-danger-50 border-danger-200 text-danger-800',
  };

  return (
    <div
      className={`px-4 py-3 rounded-lg border shadow-lg flex items-center gap-3 ${types[type]}`}
      role="alert"
    >
      <span className="text-sm font-medium">{message}</span>
      <button
        onClick={onClose}
        className="text-current opacity-70 hover:opacity-100"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
};

export default Toast;
