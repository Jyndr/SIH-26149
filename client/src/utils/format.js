export const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const formatDate = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString();
};

export const truncateHash = (hash, size = 10) => {
  if (!hash) return '—';
  if (hash.length <= size * 2) return hash;
  return `${hash.slice(0, size)}…${hash.slice(-6)}`;
};

export const caseKey = (caseData) => caseData?._id || caseData?.caseId;
export const evidenceKey = (evidence) => evidence?._id || evidence?.evidenceId;
