import React from 'react';

const Card = ({ children, className = '', hover = false, ...props }) => {
  return (
    <div
      className={`bg-[#1C1C1E] border border-[#2C2C2E] rounded ${hover ? 'hover:shadow-glow-primary transition-all duration-300' : 'transition-shadow duration-200'} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

const CardHeader = ({ children, className = '' }) => {
  return (
    <div className={`px-md py-sm border-b border-[#2C2C2E] bg-[#131315] ${className}`}>
      {children}
    </div>
  );
};

const CardBody = ({ children, className = '' }) => {
  return (
    <div className={`p-md ${className}`}>
      {children}
    </div>
  );
};

const CardFooter = ({ children, className = '' }) => {
  return (
    <div className={`px-md py-sm border-t border-[#2C2C2E] bg-[#131315] rounded-b ${className}`}>
      {children}
    </div>
  );
};

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;

export default Card;
