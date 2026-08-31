import React from 'react';
import { Link } from 'react-router-dom';
import Card from '../../../components/ui/Card';
import CaseStatusBadge from './CaseStatusBadge';

const CaseCard = ({ case: caseData }) => {
  return (
    <Card hover className="group overflow-hidden">
      <Card.Body className="relative">
        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/0 to-cyan-50/0 group-hover:from-indigo-50/50 group-hover:to-cyan-50/50 transition-all duration-300 rounded-2xl"></div>
        
        <div className="relative">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-xl font-bold text-gray-900 group-hover:text-indigo-700 transition-colors mb-1">
                {caseData.title}
              </h3>
              <p className="text-xs text-gray-500 font-mono">
                {caseData.caseId}
              </p>
            </div>
            <CaseStatusBadge status={caseData.status} />
          </div>
          
          <p className="text-gray-600 text-sm mb-6 line-clamp-2 leading-relaxed">
            {caseData.description || 'No description available'}
          </p>
          
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center text-sm text-gray-500">
              <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {new Date(caseData.createdAt).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
              })}
            </div>
            
            <Link
              to={`/cases/${caseData._id}`}
              className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-semibold text-sm group-hover:translate-x-1 transition-transform duration-200"
            >
              View Details
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default CaseCard;
