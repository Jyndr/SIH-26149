import React, { useState, useEffect } from 'react';
import { FileText, Download, Eye, ShieldCheck, Clock, Layers } from 'lucide-react';
import { reportsApi, casesApi } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { HashDisplay } from '../components/common/HashDisplay';
import { Modal } from '../components/common/Modal';

export const ReportsPage = () => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const res = await reportsApi.listByCase('CASE-94821');
      if (res.data) setReports(res.data);
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs mb-1">
            <FileText className="w-4 h-4" />
            <span>REPORT VAULT // CRYPTO EVIDENCE SEALS</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
            Forensic Incident Reports
          </h1>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Finalized case dossiers with cryptographic signatures for evidentiary court presentation.
          </p>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            FETCHING FORENSIC REPORTS...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-xs">
            No forensic reports generated yet. Run a Recovery Workflow to finalize a report.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">Report ID</th>
                  <th className="py-3 px-4">Case Dossier</th>
                  <th className="py-3 px-4">Report Title</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">SHA-256 Digest</th>
                  <th className="py-3 px-4">Generated At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reports.map((rep) => (
                  <tr key={rep.reportId} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-cyan-400 whitespace-nowrap">
                      {rep.reportId}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-semibold text-slate-300">
                      {rep.caseId}
                    </td>
                    <td className="py-3.5 px-4 font-sans text-slate-200">
                      <div className="font-semibold">{rep.title}</div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">{rep.summary}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={rep.status} size="xs" />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <HashDisplay hash={rep.sha256} length={8} />
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                      {new Date(rep.createdAt).toLocaleDateString()} {new Date(rep.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedReport(rep)}
                          className="px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded hover:bg-cyan-900 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>View</span>
                        </button>
                        <button
                          onClick={() => handleDownload(rep)}
                          className="px-2.5 py-1 bg-slate-800 text-slate-200 border border-slate-700 rounded hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
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
        title={`INCIDENT REPORT // ${selectedReport?.reportId}`}
        maxWidth="max-w-3xl"
      >
        {selectedReport && (
          <div className="space-y-4 font-mono text-xs text-slate-200">
            <div className="bg-slate-950 p-4 rounded border border-cyan-500/30">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm text-cyan-400 uppercase font-sans">
                  {selectedReport.title}
                </span>
                <StatusBadge status={selectedReport.status} size="xs" />
              </div>
              <p className="text-slate-400 font-sans text-xs mb-3">
                {selectedReport.summary}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-500 block">Target Case:</span>
                  <span className="font-bold text-slate-200">{selectedReport.caseId}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Lead Operator:</span>
                  <span className="font-bold text-cyan-400">{selectedReport.generatedBy}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Pass Ratio:</span>
                  <span className="font-bold text-emerald-400">100% Validated</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Carved Size:</span>
                  <span className="font-bold text-slate-200">45.6 MB</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-slate-500 text-[10px] uppercase block mb-1">
                Cryptographic Signature Seal:
              </span>
              <div className="text-cyan-400 select-all break-all bg-slate-900 p-2 rounded text-[11px]">
                {selectedReport.sha256}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => handleDownload(selectedReport)}
                className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold uppercase tracking-wider rounded transition-all flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export Report Artifact (JSON)</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
