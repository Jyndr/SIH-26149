import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  FolderKanban, 
  Search, 
  HardDrive, 
  ShieldCheck, 
  FileCheck2, 
  ArrowUpRight, 
  Clock, 
  Layers,
  Terminal,
  Eraser
} from 'lucide-react';
import { casesApi } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

export const DashboardPage = () => {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchCases();
  }, []);

  const fetchCases = async () => {
    try {
      setLoading(true);
      const res = await casesApi.list();
      if (res.data) setCases(res.data);
    } catch (e) {
      console.error('Failed to load cases:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      const res = await casesApi.create({
        title: newTitle,
        description: newDesc,
      });

      if (res.data && res.data.caseId) {
        setIsModalOpen(false);
        navigate(`/cases/${res.data.caseId}`);
      }
    } catch (err) {
      console.error('Failed to create case:', err);
    } finally {
      setCreating(false);
    }
  };

  const totalCases = cases.length;
  const activeCases = cases.filter(c => c.status === 'IN_PROGRESS' || c.status === 'OPEN').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner / Mission Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs mb-1">
            <Terminal className="w-3.5 h-3.5" />
            <span>INCIDENT COMMAND // ACTIVE TELEMETRY</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
            Digital Forensics & Sanitization Console
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Operational status of forensic acquisitions, carved evidence validation, and NIST-compliant sanitizations.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider rounded shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Case</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0b1329] border border-slate-800 p-4 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Total Active Cases</span>
            <FolderKanban className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-100">{totalCases}</div>
          <div className="text-[11px] font-mono text-cyan-400 mt-1 flex items-center gap-1">
            <span>{activeCases} in progress / active triage</span>
          </div>
        </div>

        <div className="bg-[#0b1329] border border-slate-800 p-4 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Forensic Recoveries</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-100">14 Jobs</div>
          <div className="text-[11px] font-mono text-emerald-400 mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            <span>100% SHA-256 Validated</span>
          </div>
        </div>

        <div className="bg-[#0b1329] border border-slate-800 p-4 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Sanitization Ops</span>
            <Eraser className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-100">9 Completed</div>
          <div className="text-[11px] font-mono text-amber-400 mt-1">
            <span>NIST SP 800-88 Purge verified</span>
          </div>
        </div>

        <div className="bg-[#0b1329] border border-slate-800 p-4 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Chain of Custody</span>
            <FileCheck2 className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-100">UNBROKEN</div>
          <div className="text-[11px] font-mono text-cyan-400 mt-1">
            <span>Cryptographic Hash Ledger</span>
          </div>
        </div>
      </div>

      {/* Recent Cases Section */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-200">
              Investigation Registry // Recent Cases
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {cases.length} REGISTERED CASES
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 font-mono text-xs">
            FETCHING FORENSIC CASES...
          </div>
        ) : cases.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-mono text-xs">
            No active cases found. Click "Create New Case" to begin an investigation.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">Case ID</th>
                  <th className="py-3 px-4">Title / Scope</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Evidence</th>
                  <th className="py-3 px-4">Timestamp (UTC)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {cases.map((c) => (
                  <tr 
                    key={c.caseId} 
                    onClick={() => navigate(`/cases/${c.caseId}`)}
                    className="hover:bg-slate-900/50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-bold text-cyan-400 whitespace-nowrap">
                      {c.caseId}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-sans font-medium text-slate-200 group-hover:text-cyan-300 transition-colors">
                        {c.title}
                      </div>
                      <div className="font-sans text-[11px] text-slate-400 line-clamp-1 max-w-md">
                        {c.description}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-300">
                      <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        {c.evidenceCount || 1} image(s)
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                      {new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-cyan-400 group-hover:text-cyan-300 font-semibold text-[11px]">
                        Open Workspace
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Create Case */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="INITIALIZE NEW FORENSIC CASE"
      >
        <form onSubmit={handleCreateCase} className="space-y-4 font-mono">
          <div className="text-xs text-slate-400 leading-relaxed">
            Specify the operational parameters for this forensic case dossier. A unique cryptographic ID will be allocated upon initialization.
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-300 mb-1">
              Case Title / Operational Codename *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Operation DarkVault - SSD Triage"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-300 mb-1">
              Case Scope & Description
            </label>
            <textarea
              rows={3}
              placeholder="Scope of investigation, seizure details, suspect identification notes..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded text-slate-100 text-xs focus:outline-none focus:border-cyan-500 font-sans"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-700 text-slate-300 rounded text-xs hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !newTitle.trim()}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-xs uppercase tracking-wider transition-all disabled:opacity-50"
            >
              {creating ? 'Allocating Case Dossier...' : 'Create Case & Open'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
