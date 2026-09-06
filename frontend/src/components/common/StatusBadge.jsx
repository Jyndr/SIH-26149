import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck, RefreshCw, Lock } from 'lucide-react';

const formatStatusText = (status) => {
  if (!status) return 'Unknown';
  const s = String(status).trim();
  if (s === 'INTACT_UNBROKEN') return 'Intact';
  if (s === 'IN_PROGRESS') return 'In Progress';
  return s
    .toLowerCase()
    .split(/[\s_]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export const StatusBadge = ({ status, size = 'sm', showIcon = true }) => {
  const norm = (status || '').toUpperCase().trim();
  const label = formatStatusText(status);

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  let Icon = Clock;

  if (['VERIFIED', 'SUCCESS', 'PASS', 'COMPLETED', 'INTACT_UNBROKEN', 'FINALIZED', 'SEALED'].includes(norm)) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    Icon = ShieldCheck;
  } else if (['RUNNING', 'IN_PROGRESS', 'ANALYZING', 'CARVING'].includes(norm)) {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
    Icon = RefreshCw;
  } else if (['QUEUED', 'PENDING', 'WARNING', 'PARTIAL', 'OPEN'].includes(norm)) {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
    Icon = AlertTriangle;
  } else if (['FAILED', 'CRITICAL', 'FAIL', 'MISMATCH', 'CORRUPT', 'CANCELLED'].includes(norm)) {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
    Icon = XCircle;
  } else if (['CLOSED', 'ARCHIVED'].includes(norm)) {
    colorClasses = 'bg-slate-100 text-slate-600 border-slate-200';
    Icon = Lock;
  }

  const sizeClasses = size === 'xs'
    ? 'text-[11px] px-2 py-0.5'
    : size === 'lg'
      ? 'text-xs px-3 py-1.5 font-medium'
      : 'text-xs px-2.5 py-1 font-medium';

  const iconSizes = size === 'xs' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border ${colorClasses} ${sizeClasses} font-sans`}>
      {showIcon && <Icon className={`${iconSizes} flex-shrink-0 ${norm === 'IN_PROGRESS' || norm === 'RUNNING' ? 'animate-spin' : ''}`} />}
      <span>{label}</span>
    </span>
  );
};

