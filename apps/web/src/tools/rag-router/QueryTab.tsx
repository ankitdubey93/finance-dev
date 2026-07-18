import { useState } from 'react';
import type { QueryResponse, RagRoute } from '@finance-dev/types';
import { toolFetch } from '../../lib/api';

const EXAMPLES = [
  'What does the Acme Logistics termination clause say?',
  'What was the total transaction volume in Q3 2025?',
  "What is Vertex Cloud's SLA, and how much did we pay them in 2025?",
];

interface Turn {
  query: string;
  response?: QueryResponse;
  error?: string;
}

export default function QueryTab() {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);

  async function ask(query: string) {
    const q = query.trim();
    if (!q || loading) return;
    setInput('');
    setLoading(true);
    const index = turns.length;
    setTurns((t) => [...t, { query: q }]);

    try {
      const res = await toolFetch('/api/tools/rag-router/query', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setTurns((t) =>
        t.map((turn, i) =>
          i === index
            ? res.ok
              ? { ...turn, response: data as QueryResponse }
              : { ...turn, error: data?.error ?? 'Request failed' }
            : turn,
        ),
      );
    } catch (e) {
      setTurns((t) => t.map((turn, i) => (i === index ? { ...turn, error: String(e) } : turn)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
        {turns.length === 0 && (
          <div className="mb-6">
            <p className="mb-3 text-sm text-slate-400">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => ask(ex)}
                  className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500 hover:bg-slate-800"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-6">
          {turns.map((turn, i) => (
            <TurnView key={i} turn={turn} />
          ))}
          {loading && <p className="text-sm text-slate-400">Routing and retrieving…</p>}
        </div>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950 px-6 py-4">
        <form
          className="mx-auto flex w-full max-w-4xl gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about clauses, numbers, or both…"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-slate-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Ask
          </button>
        </form>
      </footer>
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2 text-sm">
          {turn.query}
        </div>
      </div>

      {turn.error && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/50 px-4 py-3 text-sm text-rose-300">
          {turn.error}
        </div>
      )}

      {turn.response && <ResponseView response={turn.response} />}
    </div>
  );
}

function ResponseView({ response }: { response: QueryResponse }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      {/* The routing decision — the centerpiece. */}
      <div className="mb-4 flex items-start gap-3">
        <RouteBadge route={response.route} />
        <p className="text-xs italic text-slate-400">{response.reasoning}</p>
      </div>

      <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">
        {response.answer}
      </div>

      {response.rows.length > 0 && <RowsTable rows={response.rows} />}
      {response.sql && (
        <details className="mt-4 text-xs text-slate-400">
          <summary className="cursor-pointer select-none">Generated SQL</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 p-3 text-slate-300">
            {response.sql}
          </pre>
        </details>
      )}

      {response.sources.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sources</p>
          {response.sources.map((s, i) => (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">{s.title}</span>
                <span className="text-[10px] text-slate-500">
                  {s.docType} · {(s.score * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-xs text-slate-400">{s.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RouteBadge({ route }: { route: RagRoute }) {
  const styles: Record<RagRoute, string> = {
    vector: 'bg-sky-500/15 text-sky-300 border-sky-800',
    sql: 'bg-emerald-500/15 text-emerald-300 border-emerald-800',
    hybrid: 'bg-violet-500/15 text-violet-300 border-violet-800',
  };
  const label: Record<RagRoute, string> = {
    vector: 'Vector search',
    sql: 'Text-to-SQL',
    hybrid: 'Hybrid',
  };
  return (
    <span
      className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium ${styles[route]}`}
    >
      {label[route]}
    </span>
  );
}

function RowsTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = Object.keys(rows[0] ?? {});
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-800">
              {columns.map((c) => (
                <td key={c} className="px-3 py-2 text-slate-200">
                  {String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
