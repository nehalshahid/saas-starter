import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setAccessToken, setStoredRefreshToken, getStoredRefreshToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount, if we have a refresh token from a previous session, try to
  // silently restore the session by hitting /me (which the api() wrapper
  // will transparently refresh-and-retry on 401).
  useEffect(() => {
    async function restoreSession() {
      if (!getStoredRefreshToken()) {
        setLoading(false);
        return;
      }
      try {
        const data = await api('/auth/me');
        setUser(data.user);
      } catch {
        // refresh token invalid/expired — just stay logged out
      } finally {
        setLoading(false);
      }
    }
    restoreSession();
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    setAccessToken(data.accessToken);
    setStoredRefreshToken(data.refreshToken);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (email, password) => {
    return api('/auth/register', { method: 'POST', body: { email, password } });
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = getStoredRefreshToken();
    try {
      await api('/auth/logout', { method: 'POST', body: { refreshToken } });
    } catch {
      // best-effort — clear local state regardless
    }
    setAccessToken(null);
    setStoredRefreshToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
