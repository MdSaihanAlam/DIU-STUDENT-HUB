/**
 * Thin fetch wrapper for the DIU Student Hub API.
 * - Sends the HttpOnly session cookie (credentials: 'include').
 * - Fetches and echoes the CSRF token for every state-changing request.
 * - Normalises errors into ApiError with a user-friendly message.
 */
export const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let csrfToken = null;
let csrfPromise = null;

async function ensureCsrf(force = false) {
  if (csrfToken && !force) return csrfToken;
  if (!csrfPromise || force) {
    csrfPromise = fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' })
      .then((r) => r.json())
      .then((j) => {
        csrfToken = j.data.csrfToken;
        return csrfToken;
      })
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

const SAFE = new Set(['GET', 'HEAD']);

function toQuery(params) {
  if (!params) return '';
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== false) usp.set(k, v === true ? '1' : String(v));
  });
  const s = usp.toString();
  return s ? `?${s}` : '';
}

async function request(method, path, { body, params, signal, retry = true } = {}) {
  const headers = {};
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (!SAFE.has(method)) headers['X-CSRF-Token'] = await ensureCsrf();

  let res;
  try {
    res = await fetch(`${API_BASE}${path}${toQuery(params)}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      credentials: 'include',
      signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }

  let json = null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) json = await res.json().catch(() => null);

  if (!res.ok) {
    const message = json?.error?.message || `Request failed (${res.status})`;
    // CSRF token rotated (e.g. cookie cleared) — fetch a fresh one and retry once.
    if (res.status === 403 && /security token/i.test(message) && retry) {
      await ensureCsrf(true);
      return request(method, path, { body, params, signal, retry: false });
    }
    if (res.status === 401 && path !== '/auth/me' && path !== '/auth/login') {
      window.dispatchEvent(new CustomEvent('hub:session-expired'));
    }
    throw new ApiError(message, res.status, json?.error?.details);
  }
  return json?.data ?? json;
}

export const api = {
  get: (path, params, opts) => request('GET', path, { params, ...opts }),
  post: (path, body, opts) => request('POST', path, { body, ...opts }),
  patch: (path, body, opts) => request('PATCH', path, { body, ...opts }),
  put: (path, body, opts) => request('PUT', path, { body, ...opts }),
  del: (path, opts) => request('DELETE', path, opts),
};

/** Resolve a server-relative file URL (e.g. /api/v1/files/...) against the API origin. */
export function fileUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//.test(url)) return url;
  const base = import.meta.env.VITE_API_URL;
  if (!base) return url;
  return new URL(url, base).toString();
}

export const resourceDownloadUrl = (id) => `${API_BASE}/resources/${id}/download`;
export const resourcePreviewUrl = (id) => `${API_BASE}/resources/${id}/preview`;
export const eventIcsUrl = (id) => `${API_BASE}/events/${id}/ics`;
