-- Runs first on DB init. Enables pgvector and creates the read-only role that
-- Text-to-SQL uses, so LLM-generated SQL can never mutate data.

CREATE EXTENSION IF NOT EXISTS vector;

-- Read-only role for the RAG Router's Text-to-SQL path.
-- Password is a demo default; override via env in a real deployment.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rag_readonly') THEN
    CREATE ROLE rag_readonly LOGIN PASSWORD 'rag_readonly';
  END IF;
END
$$;

-- Never let the read-only role create objects at the DB level.
REVOKE CREATE ON DATABASE finance FROM PUBLIC;
