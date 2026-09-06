import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FolderKanban,
  HardDrive,
  Eraser,
  ArrowLeft,
  Clock,
  ShieldCheck,
  FileText,
  Activity,
  AlertTriangle,
  ArrowRight,
  Database,
  Plus,
  FileCheck,
  History
} from 'lucide-react';
import { casesApi, evidenceApi, reportsApi, auditApi } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { HashDisplay } from '../components/common/HashDisplay';

export const CaseDetailsPage = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [evidenceList, setEvidenceList] = useState([]);
  const [reportsList, setReportsList] = useState([]);
  const [activeTab, setActiveTab] = useState('evidence'); // 'evidence' | 'reports' | 'audit'
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCaseWorkspace();
  }, [caseId]);

  const loadCaseWorkspace = async () => {
    try {
      setLoading(true);
      const [caseRes, evidenceRes, reportsRes] = await Promise.all([
        casesApi.getById(caseId).catch(() => ({ data: null })),
        evidenceApi.listByCase(caseId).catch(() => ({ data: [] })),
        reportsApi.listByCase ? reportsApi.listByCase(caseId).catch(() => ({ data: [] })) : Promise.resolve({ data: [] }),
      ]);
      if (caseRes?.data) setCaseData(caseRes.data);
      if (evidenceRes?.data) setEvidenceList(evidenceRes.data);
      if (reportsRes?.data) setReportsList(reportsRes.data);
    } catch (e) {
      console.error('Failed to load case workspace:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        Loading case details...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back to Cases link & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <Link
          to="/cases"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Cases</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          <StatusBadge status={caseData?.status || 'OPEN'} size="md" />
        </div>
      </div>

      {/* Case Overview Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded">
                {caseData?.caseId || caseId}
              </span>
              <span className="text-xs text-slate-500">Forensic Investigation Dossier</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {caseData?.title || 'Case Workspace'}
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
              {caseData?.description || 'Digital forensics examination workspace with chain-of-custody tracking.'}
            </p>
          </div>

          {/* Metadata Grid */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-2.5 lg:min-w-[280px]">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-500">Created:</span>
              <span className="font-medium text-slate-800">
                {new Date(caseData?.createdAt || Date.now()).toLocaleDateString()} {new Date(caseData?.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-500">Lead Investigator:</span>
              <span className="font-medium text-blue-700">Analyst (Demo User)</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-slate-500">Evidence Items:</span>
              <span className="font-medium text-slate-800">{evidenceList.length} attached</span>
            </div>
          </div>
        </div>
      </div>

      {/* PRIMARY WORKSPACE ACTIONS: RECOVERY & SANITIZATION */}
      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-3">
          Primary Operations
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Forensic Recovery */}
          <div
            onClick={() => navigate(`/cases/${caseId}/recovery`)}
            className="bg-white border-2 border-blue-200 hover:border-blue-500 rounded-lg p-6 cursor-pointer group transition-all shadow-sm hover:shadow-md relative"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <HardDrive className="w-6 h-6" />
              </div>
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-medium">
                Forensic Analysis
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
              Recover Evidence
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              Upload or inspect raw disk images, verify SHA-256 integrity, parse filesystem artifacts, and run signature carving with confidence scoring.
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <span className="text-xs text-blue-600 font-semibold group-hover:text-blue-700">
                Launch Recovery Workflow
              </span>
              <div className="w-7 h-7 rounded-full bg-blue-50 group-hover:bg-blue-600 text-blue-600 group-hover:text-white flex items-center justify-center transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Card 2: Secure Sanitization */}
          <div
            onClick={() => navigate(`/cases/${caseId}/sanitization`)}
            className="bg-white border-2 border-slate-200 hover:border-slate-400 rounded-lg p-6 cursor-pointer group transition-all shadow-sm hover:shadow-md relative"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-slate-800 group-hover:text-white transition-colors">
                <Eraser className="w-6 h-6" />
              </div>
              <span className="text-xs bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 rounded font-medium">
                NIST 800-88
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-slate-800 transition-colors">
              Secure Erasure
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-5">
              Permanently sanitize target drives or files with NIST 800-88 / DoD compliance. Includes media geometry detection and verifiable erasure certificates.
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <span className="text-xs text-slate-700 font-semibold group-hover:text-slate-900">
                Launch Secure Erasure
              </span>
              <div className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-slate-800 text-slate-700 group-hover:text-white flex items-center justify-center transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Case Tabs: Evidence, Reports, Audit */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-4 flex items-center gap-4 bg-slate-50">
          <button
            onClick={() => setActiveTab('evidence')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${activeTab === 'evidence'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <Database className="w-4 h-4" />
            <span>Attached Evidence ({evidenceList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 px-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${activeTab === 'reports'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Case Reports ({reportsList.length})</span>
          </button>
        </div>

        {/* Tab 1: Evidence */}
        {activeTab === 'evidence' && (
          <div>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-600">
                Disk images and raw data captures assigned to this case.
              </p>
              <button
                onClick={() => navigate(`/cases/${caseId}/recovery`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-md shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Upload New Evidence</span>
              </button>
            </div>

            {evidenceList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                <Database className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-medium text-slate-700">No evidence attached yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Start by launching the Recovery Workflow to upload a disk image.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                      <th className="py-3 px-4">Evidence ID</th>
                      <th className="py-3 px-4">Filename</th>
                      <th className="py-3 px-4">Size</th>
                      <th className="py-3 px-4">SHA-256 Hash</th>
                      <th className="py-3 px-4">Integrity</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {evidenceList.map((ev) => (
                      <tr key={ev.evidenceId} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-blue-600 whitespace-nowrap">
                          {ev.evidenceId}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {ev.originalFilename}
                        </td>
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {(ev.size / (1024 * 1024)).toFixed(1)} MB
                        </td>
                        <td className="py-3 px-4">
                          <HashDisplay hash={ev.sha256} length={10} />
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusBadge status={ev.integrity?.verified ? 'VERIFIED' : 'PENDING'} />
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => navigate(`/cases/${caseId}/recovery`)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline cursor-pointer"
                          >
                            Forensic Explorer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Reports */}
        {activeTab === 'reports' && (
          <div className="p-6">
            {reportsList.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-medium text-slate-700 text-sm">No reports generated yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Complete a recovery analysis or secure erasure job to generate audit reports.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {reportsList.map((rep) => (
                  <div key={rep.reportId} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{rep.title || rep.reportId}</p>
                      <p className="text-xs text-slate-500">{new Date(rep.createdAt).toLocaleDateString()} • {rep.type || 'Investigation Report'}</p>
                    </div>
                    <Link
                      to={`/reports`}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                    >
                      View in Reports
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

