import React from 'react';

const Button = ({ children, variant = 'primary', size = 'md', className = '', disabled = false, type = 'button', ...props }) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-primary text-on-primary hover:bg-primary/90 transition-colors shadow-glow-primary',
    secondary: 'bg-surface-container border border-outline-variant text-on-surface hover:border-primary transition-colors',
    danger: 'border border-error text-error hover:bg-error/10 transition-colors',
    success: 'bg-success text-white hover:bg-success/90 transition-colors',
    warning: 'bg-warning text-white hover:bg-warning/90 transition-colors',
    ghost: 'bg-transparent text-on-surface-variant hover:bg-surface-container-high transition-colors',
    outline: 'border-2 border-primary text-primary hover:bg-primary/10 transition-colors',
  };
  
  const sizes = {
    sm: 'px-sm py-xs text-sm',
    md: 'px-md py-sm text-base',
    lg: 'px-lg py-md text-lg',
  };
  
  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
};

export default Button;
