// Entry screen: create a company (tenant) or pick an existing one. Selecting a
// company sets the active tenant and drops the user into the tool dashboard.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Company } from '@finance-dev/types';
import { useCompany } from './CompanyContext';

export default function CompanySelect() {
  const { companies, loading, error, createCompany, selectCompany } = useCompany();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const navigate = useNavigate();

  function open(company: Company) {
    selectCompany(company.id);
    navigate('/');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      const company = await createCompany(trimmed);
      open(company);
    } catch (err) {
      setFormError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 px-8 py-6">
        <h1 className="text-2xl font-semibold">Finance Demo Tools</h1>
        <p className="mt-1 text-sm text-slate-400">
          Create a company workspace, then launch a tool inside it.
        </p>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        {/* Create */}
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-lg font-semibold">Create a company</h2>
          <p className="mt-1 text-sm text-slate-400">
            A company owns its own knowledge and data. Everything you upload stays
            scoped to it.
          </p>
          <form className="mt-4 flex gap-3" onSubmit={submit}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Northwind Capital"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm outline-none focus:border-slate-500"
            />
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {busy ? 'Creating…' : 'Create'}
            </button>
          </form>
          {formError && <p className="mt-3 text-sm text-rose-400">{formError}</p>}
        </section>

        {/* Pick existing */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">
            Or open an existing company
          </h2>

          {error && <p className="text-rose-400">Failed to load companies: {error}</p>}
          {loading && !error && <p className="text-slate-400">Loading companies…</p>}
          {!loading && !error && companies.length === 0 && (
            <p className="text-slate-400">No companies yet — create your first one above.</p>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {companies.map((c) => (
              <button
                key={c.id}
                onClick={() => open(c)}
                className="group flex flex-col items-start rounded-xl border border-slate-800 bg-slate-900 p-5 text-left transition hover:border-slate-600 hover:bg-slate-800/60"
              >
                <span className="text-base font-semibold">{c.name}</span>
                <span className="mt-1 text-xs text-slate-500">
                  {c.slug} · created {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
