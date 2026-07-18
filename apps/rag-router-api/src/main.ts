// RAG Router's own Node backend (isolated tool service).
// Thin domain layer: validates input, calls its OWN AI service, shapes the
// response for the dashboard. Never talks to another tool or DB schema.

import express from 'express';
import type { Request } from 'express';
import multer from 'multer';
import type { QueryRequest, QueryResponse } from '@finance-dev/types';

const PORT = Number(process.env.RAG_ROUTER_API_PORT ?? 3101);
const AI_URL = process.env.RAG_ROUTER_AI_URL ?? 'http://rag-router-ai:8101';

// Files buffered in memory, then base64-forwarded to the Python AI service,
// which owns text extraction (pypdf) + chunking + embedding.
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rag-router-api' });
});

// The active company arrives as X-Company-Id (set by the SPA, forwarded by the
// gateway). Every domain call is scoped to it.
function companyId(req: Request): string | null {
  const raw = req.header('x-company-id');
  return raw && raw.trim() ? raw.trim() : null;
}

app.post('/query', async (req, res) => {
  const company = companyId(req);
  if (!company) {
    res.status(400).json({ error: 'Missing X-Company-Id header.' });
    return;
  }

  const body = req.body as Partial<QueryRequest>;
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query) {
    res.status(400).json({ error: 'Body must include a non-empty "query" string.' });
    return;
  }

  try {
    const upstream = await fetch(`${AI_URL}/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, company_id: company }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      res.status(502).json({ error: 'AI service error', detail });
      return;
    }

    const data = (await upstream.json()) as QueryResponse;
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach AI service', detail: String(err) });
  }
});

// ── Knowledge sources: upload / list / delete (per company) ─────────────────

// Upload one or more files and/or a pasted note; each becomes one source in the
// AI service. Multipart fields: `files` (0+), optional `title`, `content`.
app.post('/documents', upload.array('files'), async (req, res) => {
  const company = companyId(req);
  if (!company) {
    res.status(400).json({ error: 'Missing X-Company-Id header.' });
    return;
  }

  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const pastedTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const pastedContent =
    typeof req.body?.content === 'string' ? req.body.content.trim() : '';

  const jobs: Array<Record<string, unknown>> = [];
  for (const file of files) {
    jobs.push({
      company_id: company,
      title: pastedTitle || file.originalname,
      doc_type: docTypeFor(file.originalname, file.mimetype),
      file_base64: file.buffer.toString('base64'),
      file_name: file.originalname,
      mime_type: file.mimetype,
    });
  }
  if (pastedContent) {
    jobs.push({
      company_id: company,
      title: pastedTitle || 'Pasted note',
      doc_type: 'text',
      content: pastedContent,
    });
  }

  if (jobs.length === 0) {
    res.status(400).json({ error: 'Provide at least one file or pasted content.' });
    return;
  }

  try {
    const created = [];
    for (const job of jobs) {
      const upstream = await fetch(`${AI_URL}/ingest`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(job),
      });
      if (!upstream.ok) {
        const detail = await upstream.text();
        res.status(502).json({ error: 'AI ingest error', detail });
        return;
      }
      created.push(await upstream.json());
    }
    res.status(201).json({ sources: created });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach AI service', detail: String(err) });
  }
});

app.get('/documents', async (req, res) => {
  const company = companyId(req);
  if (!company) {
    res.status(400).json({ error: 'Missing X-Company-Id header.' });
    return;
  }
  try {
    const upstream = await fetch(
      `${AI_URL}/documents?company_id=${encodeURIComponent(company)}`,
    );
    if (!upstream.ok) {
      const detail = await upstream.text();
      res.status(502).json({ error: 'AI service error', detail });
      return;
    }
    res.json({ sources: await upstream.json() });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach AI service', detail: String(err) });
  }
});

app.delete('/documents/:id', async (req, res) => {
  const company = companyId(req);
  if (!company) {
    res.status(400).json({ error: 'Missing X-Company-Id header.' });
    return;
  }
  try {
    const upstream = await fetch(
      `${AI_URL}/documents/${encodeURIComponent(req.params.id)}?company_id=${encodeURIComponent(company)}`,
      { method: 'DELETE' },
    );
    if (!upstream.ok) {
      const detail = await upstream.text();
      res.status(upstream.status).json({ error: 'AI service error', detail });
      return;
    }
    res.status(204).end();
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach AI service', detail: String(err) });
  }
});

function docTypeFor(fileName: string, mime: string): string {
  const lower = fileName.toLowerCase();
  if (mime.includes('pdf') || lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.md')) return 'markdown';
  if (lower.endsWith('.csv')) return 'csv';
  return 'text';
}

app.listen(PORT, () => {
  console.log(`[rag-router-api] listening on :${PORT} → AI ${AI_URL}`);
});
