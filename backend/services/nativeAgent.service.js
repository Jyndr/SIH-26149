const baseUrl = process.env.NATIVE_AGENT_URL || 'http://127.0.0.1:8765';

const request = async (endpoint, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.CYPHORA_AGENT_TOKEN
          ? { 'X-Cyphora-Agent-Token': process.env.CYPHORA_AGENT_TOKEN }
          : {}),
        ...options.headers
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.detail || `Native agent returned HTTP ${response.status}`);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
};

const post = (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) });

export default {
  health: () => request('/health'),
  listDevices: () => request('/devices'),
  getDevice: (id) => request(`/devices/${encodeURIComponent(id)}`),
  prepareAcquisition: (body) => post('/acquisition/prepare', body),
  startAcquisition: (body) => post('/acquisition/start', body),
  getAcquisition: (id) => request(`/acquisition/${encodeURIComponent(id)}`),
  prepareSanitization: (body) => post('/sanitization/prepare', body),
  startSanitization: (body) => post('/sanitization/start', body),
  getSanitization: (id) => request(`/sanitization/${encodeURIComponent(id)}`),
  startVerification: (body) => post('/verification/start', body)
};

