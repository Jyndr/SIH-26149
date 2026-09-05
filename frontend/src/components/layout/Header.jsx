import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cpu, HardDrive, Clock, Activity } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export const Header = () => {
  const [time, setTime] = useState(new Date().toUTCString().slice(17, 25) + ' UTC');
  const location = useLocation();

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toUTCString().slice(17, 25) + ' UTC');
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format breadcrumb title
  const path = location.pathname;
  let sectionTitle = 'DASHBOARD // OVERVIEW';
  if (path.includes('/recovery')) sectionTitle = 'FORENSIC WORKSPACE // DEEP RECOVERY';
  else if (path.includes('/sanitization')) sectionTitle = 'SECURE SANITIZATION // IRREVERSIBLE ERASURE';
  else if (path.includes('/cases/') && !path.includes('/recovery') && !path.includes('/sanitization')) sectionTitle = 'CASE DOSSIER // WORKSPACE';
  else if (path === '/cases') sectionTitle = 'CASE REPOSITORY // REGISTRY';
  else if (path === '/audit') sectionTitle = 'CHAIN OF CUSTODY // AUDIT TRAIL';
  else if (path === '/reports') sectionTitle = 'INCIDENT REPORTS // CRYPTO-SEALED';

  return (
    <header className="h-14 bg-[#080e1c] border-b border-slate-800/80 px-6 flex items-center justify-between select-none z-10">
      {/* Title / Section Path */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="font-mono text-xs font-bold text-slate-200 tracking-wider uppercase">
            {sectionTitle}
          </span>
        </div>
      </div>

      {/* Telemetry Status Bar */}
      <div className="flex items-center gap-5 text-[11px] font-mono">
        <div className="hidden md:flex items-center gap-1.5 text-slate-400 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400">CHAIN:</span>
          <span className="text-emerald-400 font-semibold">VERIFIED</span>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 text-slate-400 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">ENGINE:</span>
          <span className="text-cyan-400 font-semibold">ACTIVE</span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-300 bg-slate-900/90 border border-slate-800 px-2.5 py-1 rounded">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{time}</span>
        </div>
      </div>
    </header>
  );
};
