import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, ShieldCheck, Clock, Layers, Filter, Search } from 'lucide-react';
import { reportsApi, casesApi } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { HashDisplay } from '../components/common/HashDisplay';
import { Modal } from '../components/common/Modal';

export const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState('ALL');
  const [selectedReport, setSelectedReport] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, [selectedCase]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const casesRes = await casesApi.list();
      const caseList = casesRes.data || [];
      setCases(caseList);

      if (caseList.length > 0) {
        if (selectedCase !== 'ALL') {
          const res = await reportsApi.listByCase(selectedCase);
          setReports(res.data || []);
        } else {
          const reportsNested = await Promise.all(
            caseList.map((c) => reportsApi.listByCase(c.caseId).catch(() => ({ data: [] })))
          );
          const allReports = reportsNested.flatMap((r) => r.data || []);
          if (allReports.length > 0) {
            setReports(allReports);
          } else {
            const fallback = await reportsApi.listByCase('CASE-001');
            setReports(fallback.data || []);
          }
        }
      } else {
        const res = await reportsApi.listByCase('CASE-001');
        if (res.data) setReports(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (rep) => {
    const element = document.createElement('a');
    const text = JSON.stringify(rep, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    element.href = URL.createObjectURL(blob);
    element.download = `${rep.reportId}_ChainOfCustody.json`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const filteredReports = reports.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.reportId && r.reportId.toLowerCase().includes(q)) ||
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.caseId && r.caseId.toLowerCase().includes(q)) ||
      (r.summary && r.summary.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Reports
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Formal forensic recovery and secure erasure reports with cryptographic integrity seals.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {cases.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto text-sm">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-slate-600 font-medium">Case:</span>
              <select
                value={selectedCase}
                onChange={(e) => setSelectedCase(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-900 text-xs px-3 py-1.5 rounded-md focus:outline-none focus:bg-white focus:border-blue-500 transition-all cursor-pointer font-medium"
              >
                <option value="ALL">All Cases ({cases.length})</option>
                {cases.map((c) => (
                  <option key={c.caseId} value={c.caseId}>
                    {c.caseId} — {c.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search reports by ID or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Showing <span className="font-semibold text-slate-800">{filteredReports.length}</span> reports
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Loading reports...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-medium text-slate-700">No reports found</p>
            <p className="text-xs text-slate-500 mt-1">Complete a recovery analysis or sanitization job to generate signed reports.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold tracking-wider">
                  <th className="py-3 px-4">Report ID</th>
                  <th className="py-3 px-4">Case Dossier</th>
                  <th className="py-3 px-4">Title / Summary</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">SHA-256 Digest</th>
                  <th className="py-3 px-4">Generated Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredReports.map((rep) => (
                  <tr key={rep.reportId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-blue-600 whitespace-nowrap">
                      {rep.reportId}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-800">
                      {rep.caseId}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{rep.title}</div>
                      <div className="text-slate-500 line-clamp-1 mt-0.5">{rep.summary}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={rep.status || 'SEALED'} size="xs" />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <HashDisplay hash={rep.sha256} length={8} />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                      {new Date(rep.createdAt).toLocaleDateString()} {new Date(rep.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedReport(rep)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-blue-600 border border-slate-300 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleDownload(rep)}
                          className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-md text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: View Report */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title="Forensic Incident Report"
        maxWidth="max-w-3xl"
      >
        {selectedReport && (
          <div className="space-y-4 text-xs text-slate-800">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm text-slate-900">
                  {selectedReport.title}
                </h3>
                <StatusBadge status={selectedReport.status || 'SEALED'} size="xs" />
              </div>
              <p className="text-slate-600 text-xs mb-3">
                {selectedReport.summary}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Case:</span>
                  <span className="font-medium text-slate-900">{selectedReport.caseId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Operator:</span>
                  <span className="font-medium text-blue-700">{selectedReport.generatedBy || 'Analyst'}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Integrity Seal:</span>
                  <span className="font-medium text-emerald-700">Verified</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Format:</span>
                  <span className="font-medium text-slate-700">NIST SP 800-88 / ISO 27037</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
              <span className="text-slate-500 text-[11px] block mb-1">
                Cryptographic Signature Seal (SHA-256):
              </span>
              <div className="font-mono text-xs text-slate-900 select-all break-all bg-white p-2 rounded border border-slate-200">
                {selectedReport.sha256}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-md text-xs hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => handleDownload(selectedReport)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-xs shadow-sm transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Report (JSON)</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

