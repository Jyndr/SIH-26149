import React from 'react';

const FormField = ({ label, error, children, required = false, className = '', ...props }) => {
  return (
    <div className={`mb-4 ${className}`} {...props}>
      {label && (
        <label className="block font-label-caps text-label-caps text-on-surface-variant uppercase mb-2">
          {label}
          {required && <span className="text-error ml-1">*</span>}
        </label>
      )}
      {children}
      {error && (
        <p className="mt-1 text-sm text-error font-code-md">{error}</p>
      )}
    </div>
  );
};

const Input = ({ className = '', ...props }) => {
  return (
    <input
      className={`w-full px-4 py-2.5 border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 placeholder:text-outline-variant bg-surface-container-low text-on-surface font-code-md ${className}`}
      {...props}
    />
  );
};

const Textarea = ({ className = '', rows = 4, ...props }) => {
  return (
    <textarea
      rows={rows}
      className={`w-full px-4 py-2.5 border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 placeholder:text-outline-variant resize-none bg-surface-container-low text-on-surface font-code-md ${className}`}
      {...props}
    />
  );
};

const Select = ({ children, className = '', ...props }) => {
  return (
    <select
      className={`w-full px-4 py-2.5 border border-outline-variant rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all duration-200 bg-surface-container-low text-on-surface font-code-md ${className}`}
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
