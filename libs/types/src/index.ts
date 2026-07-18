// Shared API contracts (FE ↔ platform-api ↔ tool services).
// Declared once here; do not redeclare per app (CLAUDE.md §9).

// ── Platform: companies (tenants) ───────────────────────────────────────────

/** A company/workspace tenant. Owned by platform-api (schema `platform`). */
export interface Company {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

/** Client → platform-api: create a company. */
export interface CreateCompanyRequest {
  name: string;
}

// ── Tool: knowledge sources (RAG Router) ────────────────────────────────────

/**
 * One uploaded knowledge source (a file or a pasted note), scoped to a company.
 * A source is chunked into many embedded rows sharing its `id` (source_id).
 * The active company travels FE → gateway as the `X-Company-Id` header; the
 * tool's Node backend forwards it as `companyId`/`company_id` to its AI service.
 */
export interface KnowledgeSource {
  id: string;
  title: string;
  docType: string;
  /** Number of embedded chunks this source produced. */
  chunks: number;
  createdAt: string;
}

/** How the router classified a query. */
export type RagRoute = 'vector' | 'sql' | 'hybrid';

/** Client → tool: a natural-language question. */
export interface QueryRequest {
  query: string;
}

/** A structured row for table/chart rendering in the dashboard. */
export type ResultRow = Record<string, string | number | boolean | null>;

/** Tool → client: the synthesized answer plus the evidence behind it. */
export interface QueryResponse {
  /** The final, synthesized natural-language answer. */
  answer: string;
  /** Which path the query was routed to. */
  route: RagRoute;
  /** Human-readable justification for the routing decision (surfaced in the UI). */
  reasoning: string;
  /** Qualitative snippets returned by pgvector semantic search (if any). */
  sources: VectorSource[];
  /** Structured rows returned by Text-to-SQL (if any). */
  rows: ResultRow[];
  /** The SQL that Text-to-SQL generated, for transparency (if the sql path ran). */
  sql?: string;
}

/** One qualitative snippet from the vector layer. */
export interface VectorSource {
  title: string;
  docType: string;
  snippet: string;
  /** Cosine similarity (0–1); higher is closer. */
  score: number;
}
