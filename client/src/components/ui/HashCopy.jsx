import React, { useState } from 'react';
import { truncateHash } from '../../utils/format';
import useUIStore from '../../store/uiStore';

const HashCopy = ({ value }) => {
  const pushToast = useUIStore((s) => s.pushToast);
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-gray-500">—</span>;

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    pushToast('success', 'Hash copied');
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button type="button" onClick={copy} className="font-mono text-xs text-gray-700 hover:text-primary-700">
      {copied ? 'Copied' : truncateHash(value)}
    </button>
  );
};

export default HashCopy;
