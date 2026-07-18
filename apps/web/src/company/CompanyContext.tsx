// Active-company (tenant) state for the whole shell. Persists the selection in
// localStorage so tool API calls (via toolFetch) can attach X-Company-Id.

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Company } from '@finance-dev/types';
import { getActiveCompanyId, setActiveCompanyId } from '../lib/api';

interface CompanyContextValue {
  companies: Company[];
  activeCompany: Company | null;
  loading: boolean;
  error: string | null;
  createCompany: (name: string) => Promise<Company>;
  selectCompany: (id: string) => void;
  clearActive: () => void;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | null>(null);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => getActiveCompanyId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load companies');
      setCompanies(data.companies as Company[]);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Drop a stale active id if it no longer exists (e.g. company was deleted).
  useEffect(() => {
    if (!loading && activeId && !companies.some((c) => c.id === activeId)) {
      setActiveId(null);
      setActiveCompanyId(null);
    }
  }, [loading, activeId, companies]);

  const selectCompany = useCallback((id: string) => {
    setActiveId(id);
    setActiveCompanyId(id);
  }, []);

  const clearActive = useCallback(() => {
    setActiveId(null);
    setActiveCompanyId(null);
  }, []);

  const createCompany = useCallback(async (name: string): Promise<Company> => {
    const res = await fetch('/api/companies', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? 'Failed to create company');
    const company = data.company as Company;
    setCompanies((prev) => [company, ...prev]);
    return company;
  }, []);

  const activeCompany = companies.find((c) => c.id === activeId) ?? null;

  return (
    <CompanyContext.Provider
      value={{
        companies,
        activeCompany,
        loading,
        error,
        createCompany,
        selectCompany,
        clearActive,
        refresh,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within <CompanyProvider>');
  return ctx;
}
