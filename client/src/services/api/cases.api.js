import axiosClient from './axiosClient.js';

const payload = (envelope) => envelope?.data ?? envelope;

export const casesApi = {
  list: async (params = {}) => payload(await axiosClient.get('/cases', { params })),
  getById: async (caseId) => payload(await axiosClient.get(`/cases/${caseId}`)),
  create: async (data) => payload(await axiosClient.post('/cases', data)),
  update: async (caseId, data) => payload(await axiosClient.patch(`/cases/${caseId}`, data)),
};

export default casesApi;
