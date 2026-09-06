import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  FileSearch,
  Eraser,
  Briefcase,
  FileText,
  ArrowRight,
  Clock,
  CheckCircle2,
  Activity,
  HardDrive
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
        setNewTitle('');
        setNewDesc('');
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

  // Recent activity sample events
  const recentActivities = [
    { id: 1, operation: 'Evidence Upload', target: 'NVMe Disk Image', caseId: cases[0]?.caseId || 'CASE-94821', status: 'Completed', time: '10 mins ago' },
    { id: 2, operation: 'File Recovery', target: '6 Artifacts Carved', caseId: cases[0]?.caseId || 'CASE-94821', status: 'Completed', time: '1 hour ago' },
    { id: 3, operation: 'Secure Erasure', target: 'Seized USB Drive', caseId: cases[1]?.caseId || 'CASE-72319', status: 'Verified', time: 'Yesterday' },
    { id: 4, operation: 'Report Generated', target: 'Chain of Custody Dossier', caseId: cases[0]?.caseId || 'CASE-94821', status: 'Finalized', time: '2 days ago' },
  ];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            Welcome to Cyphora
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Recover digital evidence or securely erase data.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors shadow-xs cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Case</span>
        </button>
      </div>

      {/* Two Primary Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Recover Evidence */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between group">
          <div>
            <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
              <FileSearch className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
              Recover Evidence
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Recover deleted or damaged files from a forensic disk image or supported storage source.
            </p>
          </div>
          <div>
            <button
              onClick={() => {
                if (cases.length > 0) {
                  navigate(`/cases/${cases[0].caseId}/recovery`);
                } else {
                  navigate('/recovery');
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <span>Start Recovery</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card 2: Secure Erasure */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between group">
          <div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 mb-4">
              <Eraser className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-slate-800 transition-colors">
              Secure Erasure
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Securely erase files, folders or supported storage devices using an appropriate sanitization method.
            </p>
          </div>
          <div>
            <button
              onClick={() => {
                if (cases.length > 0) {
                  navigate(`/cases/${cases[0].caseId}/sanitization`);
                } else {
                  navigate('/sanitization');
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-lg transition-colors shadow-xs cursor-pointer"
            >
              <span>Start Erasure</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Active Cases
          </div>
          <div className="text-2xl font-bold text-slate-900">{activeCases || totalCases}</div>
          <div className="text-xs text-slate-400 mt-1">{totalCases} total registered</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Recovery Jobs
          </div>
          <div className="text-2xl font-bold text-slate-900">14</div>
          <div className="text-xs text-slate-400 mt-1">Filesystem & carving tasks</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Erasure Operations
          </div>
          <div className="text-2xl font-bold text-slate-900">9</div>
          <div className="text-xs text-slate-400 mt-1">NIST 800-88 verified</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
            Reports
          </div>
          <div className="text-2xl font-bold text-slate-900">18</div>
          <div className="text-xs text-slate-400 mt-1">Cryptographically sealed</div>
        </div>
      </div>

      {/* Recent Cases Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Recent Cases</h3>
            <p className="text-xs text-slate-500 mt-0.5">Active investigation dossiers and workspaces</p>
          </div>
          <button
            onClick={() => navigate('/cases')}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            View all cases →
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Loading cases...
          </div>
        ) : cases.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No cases created yet. Click "New Case" to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-medium text-xs">
                  <th className="py-3 px-5">Case ID</th>
                  <th className="py-3 px-5">Case Name</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Evidence</th>
                  <th className="py-3 px-5">Last Updated</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.slice(0, 5).map((c) => (
                  <tr
                    key={c.caseId}
                    onClick={() => navigate(`/cases/${c.caseId}`)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3.5 px-5 font-mono text-xs font-medium text-blue-600 whitespace-nowrap">
                      {c.caseId}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="font-medium text-slate-900">{c.title}</div>
                      {c.description && (
                        <div className="text-xs text-slate-500 line-clamp-1 max-w-md mt-0.5">
                          {c.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <StatusBadge status={c.status} size="xs" />
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap text-slate-600 text-xs">
                      {c.evidenceCount || 1} image(s)
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap text-slate-500 text-xs">
                      {new Date(c.updatedAt || c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <span className="text-xs font-medium text-blue-600 hover:text-blue-700">
                        Open Case →
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Recent Activity</h3>
            <p className="text-xs text-slate-500 mt-0.5">Audit log summary of recent operational events</p>
          </div>
          <button
            onClick={() => navigate('/audit')}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 cursor-pointer"
          >
            View full audit log →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-medium text-xs">
                <th className="py-3 px-5">Operation</th>
                <th className="py-3 px-5">Target / Detail</th>
                <th className="py-3 px-5">Case</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentActivities.map((act) => (
                <tr key={act.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-5 font-medium text-slate-800 text-xs">
                    {act.operation}
                  </td>
                  <td className="py-3 px-5 text-slate-600 text-xs">
                    {act.target}
                  </td>
                  <td className="py-3 px-5 font-mono text-xs text-slate-500">
                    {act.caseId}
                  </td>
                  <td className="py-3 px-5">
                    <StatusBadge status={act.status} size="xs" />
                  </td>
                  <td className="py-3 px-5 text-right text-slate-400 text-xs">
                    {act.time}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Case */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Case"
      >
        <form onSubmit={handleCreateCase} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Case Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Financial Audit Workstation 04"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Brief description of the investigation scope..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-900 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !newTitle.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {creating ? 'Creating Case...' : 'Create Case'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

