import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export const HashDisplay = ({ hash, truncate = true, length = 12, label = '' }) => {
  const [copied, setCopied] = useState(false);

  if (!hash) return <span className="text-slate-500 font-mono text-xs">--</span>;

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
    <div className="inline-flex items-center gap-1.5 font-mono text-xs text-cyan-400/90 bg-slate-950/70 border border-slate-800/80 px-2 py-0.5 rounded group hover:border-cyan-500/40 transition-colors">
      {label && <span className="text-slate-400 text-[10px] tracking-wider uppercase mr-1">{label}</span>}
      <span className="select-all tracking-tight" title={hash}>
        {displayHash}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="text-slate-500 hover:text-cyan-300 transition-colors p-0.5"
        title="Copy full SHA-256 hash"
      >
        {copied ? (
          <Check className="w-3 h-3 text-emerald-400 animate-in fade-in" />
        ) : (
          <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />
        )}
      </button>
    </div>
  );
};
