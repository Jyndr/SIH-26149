import axiosClient from './axiosClient.js';

const payload = (envelope) => envelope?.data ?? envelope;

export const jobsApi = {
  list: async (caseId, params = {}) => payload(await axiosClient.get(`/cases/${caseId}/jobs`, { params })),
  getById: async (jobId) => payload(await axiosClient.get(`/jobs/${jobId}`)),
};

export default jobsApi;
