import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ToolManifest } from '@finance-dev/tool-registry';
import { useCompany } from './company/CompanyContext';

export default function Dashboard() {
  const { activeCompany } = useCompany();
  const [tools, setTools] = useState<ToolManifest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/registry')
      .then((r) => r.json())
      .then((data) => setTools(data.tools))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <header className="flex items-start justify-between border-b border-slate-800 px-8 py-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-400">
            {activeCompany?.name ?? 'No company'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">Finance Demo Tools</h1>
          <p className="mt-1 text-sm text-slate-400">
            A portfolio of finance + technology tools. Pick one to launch it.
          </p>
        </div>
        <Link
          to="/companies"
          className="mt-1 rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500 hover:bg-slate-800"
        >
          Switch company
        </Link>
      </header>

      <main className="px-8 py-8">
        {error && <p className="text-rose-400">Failed to load tools: {error}</p>}
        {!tools && !error && <p className="text-slate-400">Loading tools…</p>}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {tools?.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </main>
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolManifest }) {
  const disabled = tool.status !== 'live';
  const card = (
    <div
      className={`group flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900 p-6 transition ${
        disabled ? 'opacity-60' : 'hover:border-slate-600 hover:bg-slate-800/60'
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-3xl">{tool.icon}</span>
        <StatusBadge status={tool.status} />
      </div>
      <h2 className="text-lg font-semibold">{tool.name}</h2>
      <p className="mt-2 flex-1 text-sm text-slate-400">{tool.description}</p>
    </div>
  );

  return disabled ? card : <Link to={tool.route}>{card}</Link>;
}

function StatusBadge({ status }: { status: ToolManifest['status'] }) {
  const styles: Record<ToolManifest['status'], string> = {
    live: 'bg-emerald-500/15 text-emerald-300',
    beta: 'bg-amber-500/15 text-amber-300',
    'coming-soon': 'bg-slate-500/15 text-slate-300',
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}
