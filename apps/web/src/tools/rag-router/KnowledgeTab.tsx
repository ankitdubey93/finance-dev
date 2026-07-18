// Knowledge tab: upload sources (PDF / .txt / .md / .csv or pasted text) that
// get chunked, embedded, and fed into this company's vector search. Sources are
// scoped to the active company via the X-Company-Id header (toolFetch).

import { useCallback, useEffect, useRef, useState } from 'react';
import type { KnowledgeSource } from '@finance-dev/types';
import { toolFetch } from '../../lib/api';

const ACCEPT = '.pdf,.txt,.md,.csv';

export default function KnowledgeTab() {
  const [sources, setSources] = useState<KnowledgeSource[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'file' | 'paste'>('file');

  const load = useCallback(async () => {
    try {
      const res = await toolFetch('/api/tools/rag-router/documents');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load sources');
      setSources(data.sources as KnowledgeSource[]);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-6">
      <div className="mb-6 flex gap-2">
        <TabButton active={mode === 'file'} onClick={() => setMode('file')}>
          Upload files
        </TabButton>
        <TabButton active={mode === 'paste'} onClick={() => setMode('paste')}>
          Paste text
        </TabButton>
      </div>

      {mode === 'file' ? (
        <FileUpload onUploaded={load} />
      ) : (
        <PasteUpload onUploaded={load} />
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-500">
          Knowledge sources
        </h2>

        {error && <p className="text-rose-400">{error}</p>}
        {!sources && !error && <p className="text-slate-400">Loading sources…</p>}
        {sources && sources.length === 0 && (
          <p className="rounded-lg border border-dashed border-slate-800 px-4 py-8 text-center text-sm text-slate-500">
            No sources yet. Upload a document or paste text to build this company's
            knowledge base.
          </p>
        )}

        <div className="space-y-2">
          {sources?.map((s) => (
            <SourceRow key={s.id} source={s} onDeleted={load} />
          ))}
        </div>
      </section>
    </main>
  );
}

function FileUpload({ onUploaded }: { onUploaded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of list) form.append('files', f);
      const res = await toolFetch('/api/tools/rag-router/documents', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? data?.detail ?? 'Upload failed');
      onUploaded();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void upload(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
          dragging
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-slate-700 bg-slate-900/40 hover:border-slate-500'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => e.target.files && upload(e.target.files)}
        />
        <span className="text-sm text-slate-300">
          {busy ? 'Uploading & embedding…' : 'Drop files here or click to browse'}
        </span>
        <span className="mt-1 text-xs text-slate-500">PDF, TXT, MD, CSV</span>
      </label>
      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
    </div>
  );
}

function PasteUpload({ onUploaded }: { onUploaded: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      if (title.trim()) form.append('title', title.trim());
      form.append('content', content);
      const res = await toolFetch('/api/tools/rag-router/documents', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? data?.detail ?? 'Upload failed');
      setTitle('');
      setContent('');
      onUploaded();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title (optional)"
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm outline-none focus:border-slate-500"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste the text to add to this company's knowledge base…"
        rows={8}
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-slate-500"
      />
      <button
        type="submit"
        disabled={busy || !content.trim()}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? 'Adding…' : 'Add source'}
      </button>
      {error && <p className="text-sm text-rose-400">{error}</p>}
    </form>
  );
}

function SourceRow({
  source,
  onDeleted,
}: {
  source: KnowledgeSource;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const res = await toolFetch(`/api/tools/rag-router/documents/${source.id}`, {
        method: 'DELETE',
      });
      if (res.ok) onDeleted();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-200">{source.title}</p>
        <p className="text-xs text-slate-500">
          {source.docType} · {source.chunks} chunk{source.chunks === 1 ? '' : 's'} ·{' '}
          {new Date(source.createdAt).toLocaleString()}
        </p>
      </div>
      <button
        onClick={remove}
        disabled={busy}
        className="ml-4 shrink-0 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-rose-700 hover:text-rose-300 disabled:opacity-50"
      >
        {busy ? 'Removing…' : 'Delete'}
      </button>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
        active ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );
}
