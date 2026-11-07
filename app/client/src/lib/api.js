/** Thin wrapper over the JSON API. Throws ApiError, redirects to /login on 401. */

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body || {};
  }
}

async function request(method, url, body, { raw = false } = {}) {
  const opts = { method, headers: { 'X-Requested-With': 'prospect-hub' } };
  if (body !== undefined) {
    opts.body = raw ? body : JSON.stringify(body);
    opts.headers['Content-Type'] = raw ? 'text/csv' : 'application/json';
  }
  const res = await fetch(url, opts);
  if (res.status === 401 && !url.endsWith('/session')) {
    if (window.location.pathname !== '/login') window.location.replace('/login');
    throw new ApiError('Signed out', 401);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Request failed', res.status, data);
  return data;
}

const get = (url) => request('GET', url);

export const api = {
  session: () => get('/api/session'),
  login: (email, password) => request('POST', '/api/login', { email, password }),
  setup: (email, password) => request('POST', '/api/setup', { email, password }),
  logout: () => request('POST', '/api/logout', {}),

  config: () => get('/api/config'),
  saveAiKey: (key) => request('PUT', '/api/ai-key', { key }),
  removeAiKey: () => request('DELETE', '/api/ai-key'),

  assistantHistory: () => get('/api/assistant'),
  askAssistant: (message) => request('POST', '/api/assistant', { message }),
  clearAssistant: () => request('DELETE', '/api/assistant'),

  getSettings: () => get('/api/settings'),
  saveSettings: (s) => request('PUT', '/api/settings', s),

  leads: () => get('/api/leads'),
  lead: (id) => get(`/api/leads/${encodeURIComponent(id)}`),
  patchLead: (id, patch) => request('PATCH', `/api/leads/${encodeURIComponent(id)}`, patch),
  placesLookup: (id) => request('POST', `/api/leads/${encodeURIComponent(id)}/places`, {}),
  draft: (id, options) => request('POST', `/api/leads/${encodeURIComponent(id)}/draft`, options),
  send: (id, payload) => request('POST', `/api/leads/${encodeURIComponent(id)}/send`, payload),
  addLog: (id, entry) => request('POST', `/api/leads/${encodeURIComponent(id)}/log`, entry),
  removeLog: (id, index) => request('DELETE', `/api/leads/${encodeURIComponent(id)}/log/${index}`),

  outbox: () => get('/api/outbox'),
  currentJob: () => get('/api/jobs/current'),
  startJob: (type, scope) => request('POST', '/api/jobs/start', { type, scope }),
  cancelJob: () => request('POST', '/api/jobs/cancel', {}),
  importCsv: (text) => request('POST', '/api/import', text, { raw: true })
};
