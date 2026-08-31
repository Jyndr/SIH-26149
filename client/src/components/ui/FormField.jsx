import React from 'react';

const FormField = ({ label, error, children, className = '', ...props }) => {
  return (
    <div className={`mb-4 ${className}`} {...props}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      {children}
      {error && (
        <p className="mt-1 text-sm text-danger-600">{error}</p>
      )}
    </div>
  );
};

const Input = ({ className = '', ...props }) => {
  return (
    <input
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${className}`}
      {...props}
    />
  );
};

const Textarea = ({ className = '', ...props }) => {
  return (
    <textarea
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none ${className}`}
      {...props}
    />
  );
};

const Select = ({ children, className = '', ...props }) => {
  return (
    <select
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent ${className}`}
      {...props}
    >
      {children}
    </select>
  );
};

FormField.Input = Input;
FormField.Textarea = Textarea;
FormField.Select = Select;

export default FormField;
