import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

const OrgContext = createContext(null);

export function OrgProvider({ children }) {
  const { user } = useAuth();
  const [orgs, setOrgs] = useState([]);
  const [activeOrgId, setActiveOrgId] = useState(() => localStorage.getItem('activeOrgId'));
  const [loading, setLoading] = useState(true);

  const refreshOrgs = useCallback(async () => {
    if (!user) {
      setOrgs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = await api('/orgs');
    setOrgs(data.organizations);
    // If no active org selected yet (or the stored one no longer applies), default to the first.
    setActiveOrgId((prev) => {
      const stillValid = data.organizations.some((o) => o.id === prev);
      const next = stillValid ? prev : data.organizations[0]?.id || null;
      if (next) localStorage.setItem('activeOrgId', next);
      return next;
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refreshOrgs();
  }, [refreshOrgs]);

  const switchOrg = useCallback((orgId) => {
    setActiveOrgId(orgId);
    localStorage.setItem('activeOrgId', orgId);
  }, []);

  const activeOrg = orgs.find((o) => o.id === activeOrgId) || null;

  return (
    <OrgContext.Provider value={{ orgs, activeOrg, activeOrgId, switchOrg, refreshOrgs, loading }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used within OrgProvider');
  return ctx;
}
