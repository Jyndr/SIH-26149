import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export const HashDisplay = ({ hash, truncate = true, length = 12, label = '' }) => {
  const [copied, setCopied] = useState(false);

  if (!hash) return <span className="text-slate-400 font-mono text-xs">—</span>;

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayHash = truncate && hash.length > (length * 2)
    ? `${hash.substring(0, length)}...${hash.substring(hash.length - 8)}`
    : hash;

  return (
    <div className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-700 bg-slate-100/90 border border-slate-200 px-2 py-0.5 rounded group hover:border-slate-300 transition-colors">
      {label && <span className="text-slate-500 text-[10px] uppercase font-sans mr-0.5">{label}:</span>}
      <span className="select-all tracking-tight font-medium" title={hash}>
        {displayHash}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="text-slate-400 hover:text-slate-700 transition-colors p-0.5"
        title="Copy full SHA-256 hash"
      >
        {copied ? (
          <Check className="w-3 h-3 text-emerald-600" />
        ) : (
          <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />
        )}
      </button>
    </div>
  );
};

