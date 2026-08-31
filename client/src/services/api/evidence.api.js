import axiosClient from './axiosClient.js';

const payload = (envelope) => envelope?.data ?? envelope;

export const evidenceApi = {
  list: async (caseId, params = {}) => payload(await axiosClient.get(`/cases/${caseId}/evidence`, { params })),
  getById: async (evidenceId) => payload(await axiosClient.get(`/evidence/${evidenceId}`)),
  upload: async (caseId, formData, onUploadProgress) =>
    payload(await axiosClient.post(`/cases/${caseId}/evidence`, formData, { onUploadProgress })),
  verifyIntegrity: async (evidenceId) => payload(await axiosClient.post(`/evidence/${evidenceId}/verify`)),
  analyze: async (evidenceId) => payload(await axiosClient.post(`/evidence/${evidenceId}/analyze`)),
  recover: async (evidenceId) => payload(await axiosClient.post(`/evidence/${evidenceId}/recover`)),
  recoveryResults: async (evidenceId) => payload(await axiosClient.get(`/evidence/${evidenceId}/recovery-results`)),
};

export default evidenceApi;
