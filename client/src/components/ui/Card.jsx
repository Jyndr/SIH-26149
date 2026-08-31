import React from 'react';

const Card = ({ children, className = '', hover = false, ...props }) => {
  return (
    <div
      className={`bg-white rounded-2xl shadow-lg border border-gray-100 ${hover ? 'hover:shadow-2xl hover:-translate-y-1 transition-all duration-300' : 'transition-shadow duration-200'} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

const CardHeader = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-5 border-b border-gray-100 ${className}`}>
      {children}
    </div>
  );
};

const CardBody = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-5 ${className}`}>
      {children}
    </div>
  );
};

const CardFooter = ({ children, className = '' }) => {
  return (
    <div className={`px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl ${className}`}>
      {children}
    </div>
  );
};

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
