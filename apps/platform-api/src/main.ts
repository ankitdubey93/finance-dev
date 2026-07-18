// Platform gateway. Owns ONLY cross-cutting concerns: the tool registry and
// reverse-proxying /api/tools/:slug/* to each tool's own backend, so the SPA
// sees one origin. No tool logic lives here. (Auth is a later phase.)

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { TOOLS, getTool } from '@finance-dev/tool-registry';
import { companiesRouter } from './companies.js';

const PORT = Number(process.env.PLATFORM_API_PORT ?? 3000);

// slug → upstream base URL. Resolved from env (the registry stays URL-free so
// it can also ship to the browser). Extend this map as tools are added.
const UPSTREAMS: Record<string, string | undefined> = {
  'rag-router': process.env.RAG_ROUTER_API_URL ?? 'http://rag-router-api:3101',
};

const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'platform-api' });
});

// Dashboard reads this to render tool cards.
app.get('/api/registry', (_req, res) => {
  res.json({ tools: TOOLS });
});

// Companies (tenants). Registered BEFORE the proxy so its scoped json parser
// never touches /api/tools request bodies (which must stream through untouched).
app.use(companiesRouter);

// Reverse-proxy every tool call. /api/tools/rag-router/query → <upstream>/query
app.use('/api/tools/:slug', (req, res, next) => {
  const { slug } = req.params;
  if (!getTool(slug)) {
    res.status(404).json({ error: `Unknown tool "${slug}"` });
    return;
  }
  const target = UPSTREAMS[slug];
  if (!target) {
    res.status(502).json({ error: `No upstream configured for "${slug}"` });
    return;
  }

  return createProxyMiddleware({
    target,
    changeOrigin: true,
    // Strip the /api/tools/:slug prefix so the tool sees its own routes.
    pathRewrite: (path) => path.replace(new RegExp(`^/api/tools/${slug}`), ''),
  })(req, res, next);
});

app.listen(PORT, () => {
  console.log(`[platform-api] gateway on :${PORT}`);
});
