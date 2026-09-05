import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck, Activity, Lock } from 'lucide-react';

export const StatusBadge = ({ status, size = 'sm', showIcon = true }) => {
  const norm = (status || '').toUpperCase().trim();

  let colorClasses = 'bg-slate-800/80 text-slate-300 border-slate-700';
  let Icon = Clock;

  // Strict status color coding
  if (['VERIFIED', 'SUCCESS', 'PASS', 'COMPLETED', 'INTACT_UNBROKEN', 'FINALIZED', 'SEALED'].includes(norm)) {
    colorClasses = 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]';
    Icon = ShieldCheck;
  } else if (['RUNNING', 'IN_PROGRESS', 'ANALYZING', 'CARVING'].includes(norm)) {
    colorClasses = 'bg-sky-950/60 text-sky-400 border-sky-500/40 shadow-[0_0_8px_rgba(6,182,212,0.15)] animate-pulse';
    Icon = Activity;
  } else if (['QUEUED', 'PENDING', 'WARNING', 'PARTIAL', 'OPEN'].includes(norm)) {
    colorClasses = 'bg-amber-950/60 text-amber-400 border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]';
    Icon = AlertTriangle;
  } else if (['FAILED', 'CRITICAL', 'FAIL', 'MISMATCH', 'CORRUPT', 'CANCELLED'].includes(norm)) {
    colorClasses = 'bg-rose-950/60 text-rose-400 border-rose-500/40 shadow-[0_0_8px_rgba(244,63,94,0.15)]';
    Icon = XCircle;
  } else if (['CLOSED', 'ARCHIVED'].includes(norm)) {
    colorClasses = 'bg-slate-900 text-slate-400 border-slate-700';
    Icon = Lock;
  }

  const sizeClasses = size === 'xs' 
    ? 'text-[10px] px-1.5 py-0.5 font-mono tracking-wider'
    : size === 'lg' 
      ? 'text-xs px-3 py-1.5 font-mono tracking-wider'
      : 'text-[11px] px-2.5 py-1 font-mono tracking-wider';

  const iconSizes = size === 'xs' ? 'w-2.5 h-2.5' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded border font-semibold uppercase ${colorClasses} ${sizeClasses}`}>
      {showIcon && <Icon className={`${iconSizes} flex-shrink-0`} />}
      <span>{norm}</span>
    </span>
  );
};
