// Access token lives in memory only (not localStorage) — safer against XSS,
// since a malicious script can't read it the way it could read localStorage.
// Refresh token is kept in localStorage for simplicity in this starter; in a
// stricter production setup you'd want it in an httpOnly cookie set by the
// server instead, so client-side JS can't read it at all.
let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getStoredRefreshToken() {
  return localStorage.getItem('refreshToken');
}

export function setStoredRefreshToken(token) {
  if (token) localStorage.setItem('refreshToken', token);
  else localStorage.removeItem('refreshToken');
}

async function refreshAccessToken() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new Error('Refresh failed');

  const data = await res.json();
  setAccessToken(data.accessToken);
  setStoredRefreshToken(data.refreshToken); // rotated token
  return data.accessToken;
}

/**
 * Thin fetch wrapper: attaches the bearer token, and on a 401 transparently
 * refreshes once and retries — so a brief access-token expiry never surfaces
 * as a visible error to the user, it just looks like the request was a bit slow.
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function api(path, { method = 'GET', body, retry = true } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && getStoredRefreshToken()) {
    try {
      await refreshAccessToken();
      return api(path, { method, body, retry: false }); // retry exactly once
    } catch {
      setAccessToken(null);
      setStoredRefreshToken(null);
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.details = data;
    throw err;
  }
  return data;
}
