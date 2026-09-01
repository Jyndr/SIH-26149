import axiosClient from './axiosClient.js';

const payload = (envelope) => envelope?.data ?? envelope;

export const authApi = {
  register: async (data) => payload(await axiosClient.post('/auth/register', data)),
  login: async (data) => payload(await axiosClient.post('/auth/login', data)),
  me: async () => payload(await axiosClient.get('/auth/me')),
};

export default authApi;
