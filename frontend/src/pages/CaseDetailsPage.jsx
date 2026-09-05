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
  Plus
} from 'lucide-react';
import { casesApi, evidenceApi } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { HashDisplay } from '../components/common/HashDisplay';

export const CaseDetailsPage = () => {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [caseData, setCaseData] = useState(null);
  const [evidenceList, setEvidenceList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCaseWorkspace();
  }, [caseId]);

  const loadCaseWorkspace = async () => {
    try {
      setLoading(true);
      const [caseRes, evidenceRes] = await Promise.all([
        casesApi.getById(caseId),
        evidenceApi.listByCase(caseId),
      ]);
      if (caseRes.data) setCaseData(caseRes.data);
      if (evidenceRes.data) setEvidenceList(evidenceRes.data);
    } catch (e) {
      console.error('Failed to load case workspace:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 font-mono text-xs">
        LOADING CASE WORKSPACE [{caseId}]...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono">
      {/* Back to Cases link & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <Link
          to="/cases"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>RETURN TO CASE REGISTRY</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">DOSSIER STATUS:</span>
          <StatusBadge status={caseData?.status || 'OPEN'} size="md" />
        </div>
      </div>

      {/* Case Overview Dossier Card */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-lg p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs bg-cyan-950/80 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded font-bold">
                {caseData?.caseId || caseId}
              </span>
              <span className="text-slate-500 text-xs">// INCIDENT DOSSIER</span>
            </div>
            <h1 className="text-xl font-bold text-slate-100 font-sans tracking-tight mb-2">
              {caseData?.title}
            </h1>
            <p className="text-xs text-slate-400 font-sans leading-relaxed max-w-3xl">
              {caseData?.description || 'Digital forensics examination workspace.'}
            </p>
          </div>

          {/* Timestamps & Metadata Panel */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded p-3 text-xs space-y-2 lg:min-w-[260px]">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] text-slate-500 uppercase">Created:</span>
              <span className="text-slate-300">
                {new Date(caseData?.createdAt || Date.now()).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] text-slate-500 uppercase">Investigator:</span>
              <span className="text-cyan-400 font-semibold">USR-DEMO1 (Analyst)</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[11px] text-slate-500 uppercase">Evidence Disks:</span>
              <span className="text-slate-200">{evidenceList.length} Attached</span>
            </div>
          </div>
        </div>
      </div>

      {/* PRIMARY WORKSPACE ACTIONS: RECOVERY & SANITIZATION */}
      <div>
        <div className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>Primary Operations Workspace // Select Workflow</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Forensic Recovery */}
          <div 
            onClick={() => navigate(`/cases/${caseId}/recovery`)}
            className="bg-gradient-to-br from-[#0c1833] to-[#0a1224] border-2 border-cyan-500/40 hover:border-cyan-400 rounded-lg p-6 cursor-pointer group transition-all shadow-lg hover:shadow-cyan-500/10 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none"></div>

            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-cyan-950 border border-cyan-500/50 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <HardDrive className="w-6 h-6" />
              </div>
              <span className="text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                CORE FORENSIC
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-100 mb-1 group-hover:text-cyan-300 transition-colors font-sans">
              Forensic Recovery Workflow
            </h3>
            <p className="text-xs text-slate-400 font-sans leading-relaxed mb-5">
              Acquire disk images (.dd, .raw, .E01), verify SHA-256 integrity, parse filesystems, and execute deep signature-based file carving with cryptographic audit reports.
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
              <span className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider">
                Open Recovery Pipeline
              </span>
              <div className="w-7 h-7 rounded bg-cyan-600 group-hover:bg-cyan-500 text-slate-950 flex items-center justify-center transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Card 2: Secure Sanitization */}
          <div 
            onClick={() => navigate(`/cases/${caseId}/sanitization`)}
            className="bg-gradient-to-br from-[#1c1218] to-[#120a10] border-2 border-amber-600/40 hover:border-amber-500 rounded-lg p-6 cursor-pointer group transition-all shadow-lg hover:shadow-amber-500/10 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none"></div>

            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-lg bg-amber-950 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <Eraser className="w-6 h-6" />
              </div>
              <span className="text-[10px] bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded uppercase font-bold tracking-wider">
                NIST 800-88
              </span>
            </div>

            <h3 className="text-lg font-bold text-slate-100 mb-1 group-hover:text-amber-300 transition-colors font-sans">
              Secure Data Sanitization
            </h3>
            <p className="text-xs text-slate-400 font-sans leading-relaxed mb-5">
              Permanent cryptographic erasure of sensitive disks and target files. Auto-detects media geometry (NVMe/SSD/HDD) with multi-pass zeroing and tamper-proof sanitization certification.
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800/80">
              <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">
                Open Sanitization Suite
              </span>
              <div className="w-7 h-7 rounded bg-amber-600 group-hover:bg-amber-500 text-slate-950 flex items-center justify-center transition-colors">
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Existing Evidence Attached to this Case */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Attached Evidence Images ({evidenceList.length})
            </h2>
          </div>
          
          <button
            onClick={() => navigate(`/cases/${caseId}/recovery`)}
            className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload New Evidence</span>
          </button>
        </div>

        {evidenceList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No evidence images attached yet. Launch the <span className="text-cyan-400 font-bold">Forensic Recovery Workflow</span> to upload raw disk images.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">Evidence ID</th>
                  <th className="py-3 px-4">Image Filename</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">SHA-256 Hash</th>
                  <th className="py-3 px-4">Integrity</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {evidenceList.map((ev) => (
                  <tr key={ev.evidenceId} className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 font-bold text-cyan-400 whitespace-nowrap">
                      {ev.evidenceId}
                    </td>
                    <td className="py-3 px-4 text-slate-200 font-medium">
                      {ev.originalFilename}
                    </td>
                    <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
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
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold underline"
                      >
                        Analyze / Recover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
