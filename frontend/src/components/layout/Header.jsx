import React, { useState, useEffect } from 'react';
import { ShieldCheck, Clock } from 'lucide-react';
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

  const path = location.pathname;
  let sectionTitle = 'Dashboard';
  if (path.includes('/recovery')) sectionTitle = 'Recover Evidence';
  else if (path.includes('/sanitization')) sectionTitle = 'Secure Erasure';
  else if (path.includes('/cases/') && !path.includes('/recovery') && !path.includes('/sanitization')) sectionTitle = 'Case Details';
  else if (path === '/cases') sectionTitle = 'Case Management';
  else if (path === '/audit') sectionTitle = 'Audit Log';
  else if (path === '/reports') sectionTitle = 'Reports';

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between select-none z-10 shadow-xs">
      {/* Title */}
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-800 tracking-tight">
          {sectionTitle}
        </h2>
      </div>

      {/* Status Bar */}
      <div className="flex items-center gap-4 text-xs font-sans">
        <div className="flex items-center gap-1.5 text-slate-600 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="text-slate-700 font-medium">System Online</span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-slate-500 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-md font-mono text-[11px]">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{time}</span>
        </div>
      </div>
    </header>
  );
};

