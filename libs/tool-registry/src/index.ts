// The single source of truth for what tools exist (CLAUDE.md §4).
// Drives BOTH the dashboard cards and the gateway's proxy table.
// Pure metadata only — no secrets, no URLs; the gateway resolves the upstream
// per slug from env. Safe to ship to the browser.

export type ToolStatus = 'live' | 'beta' | 'coming-soon';

export interface ToolManifest {
  /** kebab-case; the namespace across every layer (route, service, schema). */
  slug: string;
  name: string;
  description: string;
  /** Emoji icon for the dashboard card. */
  icon: string;
  /** Frontend route the card links to. */
  route: string;
  status: ToolStatus;
}

export const TOOLS: readonly ToolManifest[] = [
  {
    slug: 'rag-router',
    name: 'Agentic RAG Router',
    description:
      'Routes a financial question to semantic search, Text-to-SQL, or both — then synthesizes one answer.',
    icon: '🧭',
    route: '/tools/rag-router',
    status: 'live',
  },
];

export function getTool(slug: string): ToolManifest | undefined {
  return TOOLS.find((t) => t.slug === slug);
}
