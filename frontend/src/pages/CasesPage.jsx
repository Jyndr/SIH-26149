import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, FolderKanban, ArrowUpRight, Clock, Shield } from 'lucide-react';
import { casesApi } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

export const CasesPage = () => {
  const [cases, setCases] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
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
      console.error(e);
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

  const filtered = cases.filter((c) => {
    const matchesSearch = 
      c.caseId.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs mb-1">
            <FolderKanban className="w-4 h-4" />
            <span>CASE REGISTRY // DOSSIER VAULT</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
            Case Management
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Registered digital forensic investigation dossiers with cryptographically signed chains of custody.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-xs uppercase tracking-wider rounded shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Case</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#0b1329] border border-slate-800 p-3 rounded-lg flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by ID, codename, keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded text-slate-100 font-mono text-xs placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto font-mono text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            QUERYING CASES DATABASE...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 font-mono text-xs">
            No matching forensic cases found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">Case ID</th>
                  <th className="py-3 px-4">Title / Operational Scope</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Evidence</th>
                  <th className="py-3 px-4">Created (UTC)</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.map((c) => (
                  <tr
                    key={c.caseId}
                    onClick={() => navigate(`/cases/${c.caseId}`)}
                    className="hover:bg-slate-900/50 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-bold text-cyan-400 whitespace-nowrap">
                      {c.caseId}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-sans font-semibold text-slate-200 group-hover:text-cyan-300 transition-colors">
                        {c.title}
                      </div>
                      <div className="font-sans text-[11px] text-slate-400 line-clamp-1 max-w-lg">
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
            Specify the operational parameters for this forensic case dossier.
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
              {creating ? 'Allocating Case...' : 'Create Case & Open'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
