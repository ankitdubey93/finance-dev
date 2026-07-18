-- Schema for the Agentic RAG Router tool. Per-tool isolation: this tool only
-- ever touches schema `rag_router`.
--
-- Per CLAUDE.md §8, embeddings live ALONGSIDE the relational finance tables in
-- the same schema (co-located qualitative + quantitative data), so the vector
-- column sits on `documents` in this schema rather than in a separate store.

CREATE SCHEMA IF NOT EXISTS rag_router;

-- ── Relational (quantitative) tables — the Text-to-SQL target ────────────────

CREATE TABLE rag_router.counterparties (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL UNIQUE,
  sector  TEXT NOT NULL
);

CREATE TABLE rag_router.transactions (
  id                SERIAL PRIMARY KEY,
  txn_date          DATE NOT NULL,
  counterparty_id   INTEGER NOT NULL REFERENCES rag_router.counterparties(id),
  direction         TEXT NOT NULL CHECK (direction IN ('inflow', 'outflow')),
  category          TEXT NOT NULL,
  amount_usd        NUMERIC(14, 2) NOT NULL
);

CREATE INDEX idx_transactions_date ON rag_router.transactions (txn_date);
CREATE INDEX idx_transactions_counterparty ON rag_router.transactions (counterparty_id);

-- ── Unstructured (qualitative) table — the pgvector semantic-search target ───
-- `embedding` is populated by rag-router-ai (Gemini, 768-dim): on startup for
-- seeded rows, and at upload time for user-provided knowledge sources.
--
-- Tenant isolation: every row belongs to one company (`company_id`, an opaque
-- platform tenant id — deliberately NOT an FK, to preserve tool isolation).
-- One uploaded source is chunked into many rows sharing a `source_id`, so the
-- Knowledge tab can list and delete per-source rather than per-chunk.

CREATE TABLE rag_router.documents (
  id          SERIAL PRIMARY KEY,
  company_id  UUID NOT NULL,
  source_id   UUID NOT NULL,
  title       TEXT NOT NULL,
  doc_type    TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  embedding   vector(768)
);

-- Cosine-distance index; created now, used once embeddings are backfilled.
CREATE INDEX idx_documents_embedding
  ON rag_router.documents USING hnsw (embedding vector_cosine_ops);

-- Tenant + source lookups for scoped retrieval and the Knowledge list/delete.
CREATE INDEX idx_documents_company ON rag_router.documents (company_id);
CREATE INDEX idx_documents_source  ON rag_router.documents (source_id);

-- ── Read-only grants for Text-to-SQL ────────────────────────────────────────
-- The read-only role sees the NUMBERS tables only. It deliberately does NOT get
-- access to `documents` — hard math goes through relational SQL, never vectors.
GRANT USAGE ON SCHEMA rag_router TO rag_readonly;
GRANT SELECT ON rag_router.counterparties TO rag_readonly;
GRANT SELECT ON rag_router.transactions  TO rag_readonly;
