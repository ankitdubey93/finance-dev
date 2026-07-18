import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import './index.css';
import { CompanyProvider, useCompany } from './company/CompanyContext';
import CompanySelect from './company/CompanySelect';
import Dashboard from './Dashboard';
import RagRouter from './tools/rag-router/RagRouter';

// Gate the tenant-scoped app: without an active company, send the user to the
// company picker first (create → pick → then tools). Wait for the initial load
// so a persisted selection isn't prematurely bounced.
function RequireCompany({ children }: { children: React.ReactNode }) {
  const { activeCompany, loading } = useCompany();
  if (loading) {
    return <div className="min-h-full bg-slate-950 p-8 text-slate-400">Loading…</div>;
  }
  if (!activeCompany) return <Navigate to="/companies" replace />;
  return <>{children}</>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CompanyProvider>
        <Routes>
          <Route path="/companies" element={<CompanySelect />} />
          <Route
            path="/"
            element={
              <RequireCompany>
                <Dashboard />
              </RequireCompany>
            }
          />
          <Route
            path="/tools/rag-router/*"
            element={
              <RequireCompany>
                <RagRouter />
              </RequireCompany>
            }
          />
        </Routes>
      </CompanyProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
