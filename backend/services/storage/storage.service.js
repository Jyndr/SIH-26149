import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseStorageDir = path.resolve(__dirname, '../../storage');

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const storageService = {
  getStorageBasePath: () => baseStorageDir,
  getEvidenceStoragePath: () => ensureDir(path.join(baseStorageDir, 'evidence')),
  getRecoveredStoragePath: () => ensureDir(path.join(baseStorageDir, 'recovered')),
  getReportsStoragePath: () => ensureDir(path.join(baseStorageDir, 'reports')),
  getTempStoragePath: () => ensureDir(path.join(baseStorageDir, 'temp')),
  generateStoredFilename: (evidenceId, originalFilename) => {
    const ext = path.extname(originalFilename);
    return `${evidenceId}${ext}`;
  }
};

export default storageService;
