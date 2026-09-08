import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Briefcase,
  AlertCircle,
  ChevronDown,
  ArrowRight,
  HardDrive,
  RefreshCw
} from 'lucide-react';
import { casesApi, evidenceApi } from '../services/api';
import { ForensicAnalyst } from '../components/forensic/ForensicAnalyst';

export const AIAnalystPage = () => {
  const { caseId: routeCaseId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryCaseId = searchParams.get('caseId');
  const initialCaseId = routeCaseId || queryCaseId || '';

  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState(initialCaseId);
  const [loadingCases, setLoadingCases] = useState(true);

  const [evidence, setEvidence] = useState(null);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [error, setError] = useState(null);

  // 1. Fetch available cases
  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      setLoadingCases(true);
      const res = await casesApi.list();
      const list = res.data || [];
      setCases(list);

      // If no case selected yet, auto-select first available case if present
      if (!selectedCaseId && list.length > 0) {
        setSelectedCaseId(list[0].caseId);
      }
    } catch (err) {
      console.error('Failed to load cases:', err);
      setError('Failed to load cases list.');
    } finally {
      setLoadingCases(false);
    }
  };

  // 2. Fetch evidence whenever selectedCaseId changes
  useEffect(() => {
    if (selectedCaseId) {
      loadEvidenceForCase(selectedCaseId);
    }
  }, [selectedCaseId]);

  const loadEvidenceForCase = async (cId) => {
    try {
      setLoadingEvidence(true);
      setError(null);
      const res = await evidenceApi.listByCase(cId);
      const evList = res.data || [];
      if (evList.length > 0) {
        setEvidence(evList[0]);
      } else {
        // Fallback: create mock evidence reference so analyst can still search disk report.json
        setEvidence({
          evidenceId: cId,
          caseId: cId,
          originalFilename: `${cId}_disk_image.E01`
        });
      }
    } catch (err) {
      console.warn('Could not load evidence for case, using case identifier:', err);
      setEvidence({
        evidenceId: cId,
        caseId: cId,
        originalFilename: `${cId}_disk_image.E01`
      });
    } finally {
      setLoadingEvidence(false);
    }
  };

  const handleCaseChange = (newCaseId) => {
    setSelectedCaseId(newCaseId);
    setSearchParams({ caseId: newCaseId });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Case Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Investigation Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Forensic Analyst
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Grounded in physical disk records, partition geometry, MFT records, and recovered artifacts.
          </p>
        </div>

        {/* The ONLY option: Choose Case to talk to */}
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium pl-1">
            <Briefcase className="w-4 h-4 text-slate-400" />
            <span>Select Case:</span>
          </div>
          <div className="relative">
            <select
              value={selectedCaseId}
              onChange={(e) => handleCaseChange(e.target.value)}
              disabled={loadingCases}
              className="bg-slate-50 hover:bg-slate-100 text-slate-900 font-semibold text-xs py-1.5 pl-3 pr-8 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
            >
              {cases.map((c) => (
                <option key={c.caseId} value={c.caseId}>
                  {c.caseId} {c.title ? `— ${c.title}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>
          {loadingEvidence && (
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {loadingCases ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-500 text-sm shadow-xs">
          <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
          <span>Loading investigation cases...</span>
        </div>
      ) : !selectedCaseId ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center shadow-xs">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Case Selected</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Choose a case from the top dropdown to query disk evidence, carve logs, and recovered files.
          </p>
        </div>
      ) : (
        <div>
          {evidence ? (
            <ForensicAnalyst
              evidenceId={evidence.evidenceId}
              caseId={selectedCaseId}
              onSwitchToPipeline={() => navigate(`/cases/${selectedCaseId}/recovery`)}
            />
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-xs space-y-3">
              <HardDrive className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-800">
                No Disk Evidence Acquired for {selectedCaseId}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                To chat with the AI Analyst, upload a disk image or run the recovery pipeline first.
              </p>
              <button
                onClick={() => navigate(`/cases/${selectedCaseId}/recovery`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <span>Go to Evidence Recovery</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIAnalystPage;

