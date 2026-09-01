import fs from 'fs';
import path from 'path';

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const storageService = {
  getEvidenceStoragePath: () => ensureDir(path.join(process.cwd(), 'storage', 'evidence')),
  getRecoveredStoragePath: () => ensureDir(path.join(process.cwd(), 'storage', 'recovered')),
  getReportsStoragePath: () => ensureDir(path.join(process.cwd(), 'storage', 'reports')),
  generateStoredFilename: (evidenceId, originalFilename) => {
    const ext = path.extname(originalFilename);
    return `${evidenceId}${ext}`;
  }
};

export default storageService;
