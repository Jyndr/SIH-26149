import axiosClient from './axiosClient.js';

const payload = (envelope) => envelope?.data ?? envelope;

export const reportsApi = {
  generate: async (caseId, type) => payload(await axiosClient.post(`/cases/${caseId}/reports`, { type })),
  listForCase: async (caseId, params = {}) => payload(await axiosClient.get(`/cases/${caseId}/reports`, { params })),
  getById: async (reportId) => payload(await axiosClient.get(`/reports/${reportId}`)),
  download: async (reportId, filename = 'report.json') => {
    const response = await axiosClient.get(`/reports/${reportId}/download`, { responseType: 'blob' });
    const blob = response.data;
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default reportsApi;
