import React from 'react';

const FormField = ({ label, error, children, required = false, className = '', ...props }) => {
  return (
    <div className={`mb-4 ${className}`} {...props}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
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
      className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 placeholder-gray-400 ${className}`}
      {...props}
    />
  );
};

const Textarea = ({ className = '', rows = 4, ...props }) => {
  return (
    <textarea
      rows={rows}
      className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 placeholder-gray-400 resize-none ${className}`}
      {...props}
    />
  );
};

const Select = ({ children, className = '', ...props }) => {
  return (
    <select
      className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white ${className}`}
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
