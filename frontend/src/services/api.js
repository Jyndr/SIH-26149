import axios from 'axios';

// Base API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT Bearer token to all outbound requests
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for session expiry
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token on 401 unauthorized
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('cyphora:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// ==========================================
// UNIFIED API SERVICE EXPORTS
// ==========================================

export const authApi = {
  login: async (email, password) => {
    const res = await apiClient.post('/auth/login', { email, password });
    return res.data;
  },

  register: async (userData) => {
    const res = await apiClient.post('/auth/register', userData);
    return res.data;
  },

  me: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
};

export const casesApi = {
  list: async () => {
    const res = await apiClient.get('/cases');
    return res.data;
  },

  getById: async (caseId) => {
    const res = await apiClient.get(`/cases/${caseId}`);
    return res.data;
  },

  create: async ({ title, description }) => {
    const res = await apiClient.post('/cases', { title, description });
    return res.data;
  },
};

export const evidenceApi = {
  listByCase: async (caseId) => {
    const res = await apiClient.get(`/cases/${caseId}/evidence`);
    return res.data;
  },

  upload: async (caseId, file, onUploadProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post(`/cases/${caseId}/evidence`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0, // Disable timeout for large forensic image uploads
      onUploadProgress,
    });
    return res.data;
  },

  getById: async (evidenceId) => {
    const res = await apiClient.get(`/evidence/${evidenceId}`);
    return res.data;
  },

  verifyIntegrity: async (evidenceId) => {
    const res = await apiClient.post(`/evidence/${evidenceId}/verify`);
    return res.data;
  },
};

export const recoveryApi = {
  // Recovery continues to operate on normal Evidence records, including images registered after native acquisition.
  startRecovery: async (evidenceId) => {
    const res = await apiClient.post(`/evidence/${evidenceId}/recover`);
    return res.data;
  },

  getRecoveredFiles: async (evidenceId) => {
    try {
      const res = await apiClient.get(`/evidence/${evidenceId}/recovered-files`);
      return res.data;
    } catch (err) {
      console.error(`Failed to load recovered files for ${evidenceId}:`, err.message);
      return { success: false, data: [] };
    }
  },

  getDownloadUrl: (recoveredFileId) => {
    const token = localStorage.getItem('token');
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${API_BASE_URL}/recovered-files/${recoveredFileId}/download${query}`;
  }
};

export const nativeAgentApi = {
  health: async () => (await apiClient.get('/native-agent/health')).data,
  listDevices: async () => (await apiClient.get('/devices')).data,
  getDevice: async (deviceId) => (await apiClient.get(`/devices/${encodeURIComponent(deviceId)}`)).data,
  prepareSanitization: async (caseId, payload) =>
    (await apiClient.post(`/cases/${caseId}/sanitization/prepare`, payload)).data,
  startSanitization: async (caseId, payload) =>
    (await apiClient.post(`/cases/${caseId}/sanitization/start`, payload, { timeout: 0 })).data,
};

export const acquisitionApi = {
  start: async (caseId, payload) =>
    (await apiClient.post(`/cases/${caseId}/acquisition/start`, payload, { timeout: 20000 })).data,
  getJob: async (jobId) =>
    (await apiClient.get(`/acquisition/${encodeURIComponent(jobId)}`)).data,
};

export const forensicApi = {
  getOverview: async (evidenceId) => {
    const res = await apiClient.get(`/evidence/${evidenceId}/overview`);
    return res.data;
  },
  getFileTree: async (evidenceId, path = '/', params = {}) => {
    const res = await apiClient.get(`/evidence/${evidenceId}/files`, { params: { path, ...params } });
    return res.data;
  },
  getArtifacts: async (evidenceId, type = 'all') => {
    const res = await apiClient.get(`/evidence/${evidenceId}/artifacts`, { params: { type } });
    return res.data;
  },
  search: async (evidenceId, q = '', category = 'all') => {
    const res = await apiClient.get(`/evidence/${evidenceId}/search`, { params: { q, category } });
    return res.data;
  },
  getFilePreview: async (evidenceId, fileId) => {
    const res = await apiClient.get(`/evidence/${evidenceId}/file-preview/${fileId}`);
    return res.data;
  },
  getArtifactPreviewUrl: (evidenceId, fileId) => {
    const token = localStorage.getItem('token');
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${API_BASE_URL}/evidence/${evidenceId}/file-preview-content/${fileId}${query}`;
  },
  getDownloadUrl: (recoveredFileId) => {
    const token = localStorage.getItem('token');
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${API_BASE_URL}/recovered-files/${recoveredFileId}/download${query}`;
  },
  getArtifactDownloadUrl: (evidenceId, fileId) => {
    const token = localStorage.getItem('token');
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${API_BASE_URL}/evidence/${evidenceId}/file-download/${fileId}${query}`;
  },
  getReportDownloadUrl: (evidenceId) => {
    const token = localStorage.getItem('token');
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${API_BASE_URL}/evidence/${evidenceId}/report-download${query}`;
  },
  downloadArtifact: async (evidenceId, fileId, defaultFilename = 'artifact.dat') => {
    try {
      const response = await apiClient.get(`/evidence/${evidenceId}/file-download/${fileId}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', defaultFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  },
  ask: async (evidenceId, question) => {
    const res = await apiClient.post(`/evidence/${evidenceId}/ask`, { question });
    return res.data;
  },
  getAnalystStatus: async (evidenceId) => {
    const res = await apiClient.get(`/evidence/${evidenceId}/analyst-status`);
    return res.data;
  }
};

export const jobsApi = {
  getById: async (jobId) => {
    const res = await apiClient.get(`/jobs/${jobId}`);
    return res.data;
  },
};

export const reportsApi = {
  listByCase: async (caseId) => {
    try {
      const endpoint = (!caseId || caseId === 'ALL') ? '/reports' : `/cases/${caseId}/reports`;
      const res = await apiClient.get(endpoint);
      if (res.data && Array.isArray(res.data.data)) {
        const normalized = res.data.data.map((r) => ({
          ...r,
          reportId: r.reportId,
          caseId: r.caseId?.caseId || r.caseId || (caseId !== 'ALL' ? caseId : 'CASE-001'),
          title: r.title || `${r.type?.replace(/_/g, ' ') || 'Forensic'} Report`,
          summary: r.summary || `Automated cryptographic evidence dossier (${r.type || 'RECOVERY_REPORT'}).`,
          status: r.status || 'FINALIZED',
          sha256: r.hash || r.sha256,
          createdAt: r.generatedAt || r.createdAt,
          generatedBy: r.createdBy?.name || 'Lead Forensic Analyst',
        }));
        return { success: true, data: normalized };
      }
      return res.data;
    } catch (err) {
      throw err;
    }
  },

  create: async (caseId, payload) => {
    try {
      const body = {
        type: payload?.type || 'RECOVERY_REPORT',
        ...payload,
      };
      const res = await apiClient.post(`/cases/${caseId}/reports`, body);
      return res.data;
    } catch (err) {
      throw err;
    }
  },

  getById: async (reportId) => {
    try {
      const res = await apiClient.get(`/reports/${reportId}`);
      return res.data;
    } catch (err) {
      throw err;
    }
  },
};

export const auditApi = {
  listByCase: async (caseId) => {
    try {
      const endpoint = (!caseId || caseId === 'ALL') ? '/audit' : `/cases/${caseId}/audit`;
      const res = await apiClient.get(endpoint);
      if (res.data && Array.isArray(res.data.data)) {
        const normalized = res.data.data.map((entry) => ({
          ...entry,
          logId: entry.auditId || entry.logId,
          caseId: entry.caseId?.caseId || entry.caseId || (caseId !== 'ALL' ? caseId : ''),
          operation: entry.operation,
          user: typeof entry.actor === 'object'
            ? `${entry.actor?.name || 'Analyst'} (${entry.actor?.role || 'INVESTIGATOR'})`
            : (entry.actor || entry.user || 'Lead Forensic Analyst'),
          method: entry.details?.method || entry.target || entry.method || 'BLOCK_AUDIT',
          status: entry.result || entry.status || 'SUCCESS',
          hash: entry.recordHash || entry.hash,
          previousHash: entry.previousHash || '0000000000000000000000000000000000000000000000000000000000000000',
          timestamp: entry.timestamp,
        }));
        return { success: true, data: normalized };
      }
      return res.data;
    } catch (err) {
      throw err;
    }
  },

  verifyChain: async (caseId) => {
    try {
      const endpoint = (!caseId || caseId === 'ALL') ? '/audit/verify-chain' : `/cases/${caseId}/audit/verify-chain`;
      const res = await apiClient.get(endpoint);
      return res.data;
    } catch (err) {
      throw err;
    }
  }
};

export const sanitizationApi = {
  sanitizeTarget: async (caseId, payload) => {
    try {
      const res = await apiClient.post(`/cases/${caseId}/sanitize`, payload);
      return res.data;
    } catch (err) {
      console.error('Dry-run sanitization request failed:', err.message);
      throw err;
    }
  },

  listByCase: async (caseId) => {
    try {
      const res = await apiClient.get(`/cases/${caseId}/sanitize/jobs`);
      return res.data;
    } catch (err) {
      return { success: true, data: [] };
    }
  },

  getJob: async (sanitizationId) => {
    try {
      const res = await apiClient.get(`/sanitize/${sanitizationId}`);
      return res.data;
    } catch (err) { throw err; }
  }
};
