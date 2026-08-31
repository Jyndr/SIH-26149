import React from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Calendar, ArrowRight, FileText } from 'lucide-react';
import Card from '../../../components/ui/Card';
import CaseStatusBadge from './CaseStatusBadge';

const CaseCard = ({ case: caseData }) => {
  return (
    <Card hover={true} className="group">
      <Card.Body>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-100 to-cyan-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 line-clamp-1">
              {caseData.title}
            </h3>
          </div>
          <CaseStatusBadge status={caseData.status} />
        </div>
        
        <p className="text-gray-600 text-sm mb-4 line-clamp-2 min-h-[40px]">
          {caseData.description || 'No description provided'}
        </p>
        
        <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
          <div className="flex items-center gap-1">
            <FileText className="w-4 h-4" />
            <span>ID: {caseData.caseId}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>{new Date(caseData.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        <Link
          to={`/cases/${caseData._id}`}
          className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium text-sm group-hover:gap-3 transition-all"
        >
          View Details
          <ArrowRight className="w-4 h-4" />
        </Link>
      </Card.Body>
    </Card>
  );
};

export default CaseCard;
