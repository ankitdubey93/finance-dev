-- Platform (cross-cutting) schema. Owned by platform-api — the only shared
-- surface across tools (CLAUDE.md §2/§9). A "company" is a tenant/workspace:
-- it OWNS its knowledge and data. Tools never read this schema; they receive an
-- opaque company_id and scope their own schema by it (no cross-schema FK).

CREATE SCHEMA IF NOT EXISTS platform;

CREATE TABLE platform.companies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the demo tenant with a FIXED uuid so the RAG Router seed (20_) can attach
-- its "Northwind Capital" contract clauses to this company.
INSERT INTO platform.companies (id, name, slug) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Northwind Capital', 'northwind-capital');
