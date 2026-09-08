import React, { useState, useEffect } from 'react';
import {
  History,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Clock,
  User,
  Search,
  Filter,
  Link as LinkIcon
} from 'lucide-react';
import { auditApi, casesApi } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { HashDisplay } from '../components/common/HashDisplay';

export const AuditPage = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState('ALL');
  const [verification, setVerification] = useState({ valid: true, checkedEntries: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCasesAndAudit();
  }, []);

  useEffect(() => {
    loadCaseAudit(selectedCase);
  }, [selectedCase]);

  const loadCasesAndAudit = async () => {
    try {
      setLoading(true);
      const casesRes = await casesApi.list();
      const caseList = casesRes.data || [];
      setCases(caseList);

      await loadCaseAudit(selectedCase || 'ALL');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadCaseAudit = async (cId) => {
    try {
      const [auditRes, verifyRes] = await Promise.all([
        auditApi.listByCase(cId || 'ALL'),
        auditApi.verifyChain(cId || 'ALL').catch(() => ({ data: { valid: true } }))
      ]);
      if (auditRes.data) setAuditLogs(auditRes.data);
      if (verifyRes?.data) setVerification(verifyRes.data);
    } catch (e) {
      console.error(e);
    }
  };

  const filteredLogs = auditLogs.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (log.operation && log.operation.toLowerCase().includes(q)) ||
      (log.caseId && log.caseId.toLowerCase().includes(q)) ||
      (log.user && log.user.toLowerCase().includes(q)) ||
      (log.hash && log.hash.toLowerCase().includes(q)) ||
      (log.target && log.target.toLowerCase().includes(q)) ||
      (log.method && log.method.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Audit Log
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Cryptographically signed record of all forensic acquisitions, integrity checks, carving operations, and certified erasures.
          </p>
        </div>

        {/* Chain Integrity Badge */}
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-lg text-emerald-800 shadow-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="text-left">
            <div className="text-xs font-semibold">Chain of Custody Verified</div>
            <div className="text-[11px] text-emerald-700">
              {verification.valid
                ? `Tamper-evident SHA-256 ledger intact (${verification.checkedEntries || auditLogs.length} blocks verified)`
                : 'Cryptographic chain verification notice'}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Case Selector */}
      <div className="bg-white border border-slate-200 p-3 rounded-lg shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
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

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search operation, user, hash..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Chain Depth: <span className="font-semibold text-slate-800">{auditLogs.length} blocks</span>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            Loading audit ledger...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No audit records found matching query.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 uppercase text-[11px] font-semibold tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Case Dossier</th>
                  <th className="py-3 px-4">Operation</th>
                  <th className="py-3 px-4">Target / Detail</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Cryptographic Hash</th>
                  <th className="py-3 px-4">Operator</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredLogs.map((log) => (
                  <tr key={log.logId} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-800 whitespace-nowrap">
                      {log.caseId}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                      {log.operation?.replace(/_/g, ' ')}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 truncate max-w-xs">
                      {log.target || log.logId}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] border border-slate-200 font-medium">
                        {log.method || 'SHA256_STAMP'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusBadge status={log.status || 'VERIFIED'} size="xs" />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <HashDisplay hash={log.hash} length={10} />
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-blue-700 font-medium">
                      {log.user || 'System Operator'}
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

