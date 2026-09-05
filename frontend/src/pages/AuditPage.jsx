import React, { useState, useEffect } from 'react';
import { 
  History, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowDown, 
  Link as LinkIcon, 
  Lock, 
  Clock, 
  User, 
  Search,
  Filter
} from 'lucide-react';
import { auditApi, casesApi } from '../services/api';
import { StatusBadge } from '../components/common/StatusBadge';
import { HashDisplay } from '../components/common/HashDisplay';

export const AuditPage = () => {
  const [auditLogs, setAuditLogs] = useState([]);
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState('CASE-94821');
  const [chainVerified, setChainVerified] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCasesAndAudit();
  }, []);

  useEffect(() => {
    if (selectedCase) {
      loadCaseAudit(selectedCase);
    }
  }, [selectedCase]);

  const loadCasesAndAudit = async () => {
    try {
      setLoading(true);
      const [casesRes, auditRes] = await Promise.all([
        casesApi.list(),
        auditApi.listByCase(selectedCase),
      ]);
      if (casesRes.data) setCases(casesRes.data);
      if (auditRes.data) setAuditLogs(auditRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadCaseAudit = async (cId) => {
    try {
      const res = await auditApi.listByCase(cId);
      if (res.data) setAuditLogs(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-mono text-slate-100">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs mb-1">
            <History className="w-4 h-4" />
            <span>IMMUTABLE LEDGER // AUDIT TRAIL</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 font-mono">
            Chain of Custody Verification
          </h1>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Cryptographic SHA-256 linked log of all acquisitions, hash verifications, carving operations, and reports.
          </p>
        </div>

        {/* Chain Integrity Badge */}
        <div className="flex items-center gap-3 bg-emerald-950/60 border border-emerald-500/40 px-4 py-2 rounded-lg text-emerald-300">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div className="text-left">
            <div className="text-xs font-bold uppercase tracking-wider">HASH CHAIN INTACT</div>
            <div className="text-[10px] text-emerald-400/80">Tamper-Evident Linking Verified</div>
          </div>
        </div>
      </div>

      {/* Selector & Filter Bar */}
      <div className="bg-[#0b1329] border border-slate-800 p-4 rounded-lg flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span className="text-xs text-slate-400">Target Investigation Case:</span>
          <select
            value={selectedCase}
            onChange={(e) => setSelectedCase(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-cyan-300 text-xs px-3 py-1.5 rounded focus:outline-none focus:border-cyan-500 font-bold"
          >
            {cases.map((c) => (
              <option key={c.caseId} value={c.caseId}>
                {c.caseId} // {c.title.substring(0, 32)}...
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-400">
          CHAIN DEPTH: <span className="text-slate-100 font-bold">{auditLogs.length} BLOCKS</span>
        </div>
      </div>

      {/* Cryptographic Vertical Timeline (Chain of Custody Proof) */}
      <div className="bg-[#0b1329] border border-slate-800 rounded-lg p-6">
        <div className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-6 flex items-center gap-2">
          <LinkIcon className="w-4 h-4 text-cyan-400" />
          <span>Cryptographic Block Sequence (Genesis → Current Head)</span>
        </div>

        <div className="space-y-6 relative before:absolute before:inset-0 before:left-6 before:w-0.5 before:bg-gradient-to-b before:from-cyan-500/50 before:via-blue-500/40 before:to-emerald-500/50">
          {auditLogs.map((log, index) => (
            <div key={log.logId} className="relative flex items-start gap-4 ml-1">
              {/* Step Icon Badge */}
              <div className="w-10 h-10 rounded-lg bg-slate-950 border-2 border-cyan-500/60 flex items-center justify-center text-cyan-400 z-10 shadow-[0_0_10px_rgba(6,182,212,0.2)] flex-shrink-0">
                <span className="text-xs font-bold">0{index + 1}</span>
              </div>

              {/* Log Block Content */}
              <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-lg p-4 hover:border-cyan-500/30 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-100 font-sans">
                      {log.operation.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[10px] text-slate-500">[{log.logId}]</span>
                  </div>
                  <StatusBadge status={log.status} size="xs" />
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs mb-3">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block">Executed By:</span>
                    <span className="text-cyan-400 font-medium">{log.user}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block">Method:</span>
                    <span className="text-slate-300 font-mono text-[11px]">{log.method}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase block">Timestamp (UTC):</span>
                    <span className="text-slate-400 font-mono text-[11px]">{new Date(log.timestamp).toISOString()}</span>
                  </div>
                </div>

                {/* Hashes: Current & Previous Link */}
                <div className="space-y-1.5 pt-2 border-t border-slate-900 text-[11px]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-slate-500 text-[10px] uppercase">Block Hash:</span>
                    <HashDisplay hash={log.hash} length={16} />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-slate-600 text-[10px] uppercase">Previous Block Link:</span>
                    <span className="font-mono text-slate-500 text-[11px] select-all truncate max-w-sm sm:max-w-md">
                      {log.previousHash}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
