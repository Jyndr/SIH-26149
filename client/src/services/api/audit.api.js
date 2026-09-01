import axiosClient from './axiosClient.js';

const payload = (envelope) => envelope?.data ?? envelope;

export const auditApi = {
  listForCase: async (caseId, params = {}) => payload(await axiosClient.get(`/cases/${caseId}/audit`, { params })),
  verifyChain: async (caseId) => payload(await axiosClient.get(`/cases/${caseId}/audit/verify-chain`)),
};

export default auditApi;
