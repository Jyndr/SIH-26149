import axiosClient from './axiosClient.js';

const payload = (envelope) => envelope?.data ?? envelope;

export const sanitizationApi = {
  sanitize: async (caseId, data) => payload(await axiosClient.post(`/cases/${caseId}/sanitize`, data)),
  listJobs: async (caseId) => payload(await axiosClient.get(`/cases/${caseId}/sanitize/jobs`)),
  getJob: async (sanitizationId) => payload(await axiosClient.get(`/sanitize/${sanitizationId}`)),
};

export default sanitizationApi;
