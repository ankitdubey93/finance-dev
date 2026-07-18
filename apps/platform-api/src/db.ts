// Platform-owned Postgres access. The gateway touches ONLY the `platform`
// schema (companies/tenants) — never a tool's schema (CLAUDE.md §9).

import { Pool } from 'pg';

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgresql://finance:finance@db:5432/finance';

export const pool = new Pool({ connectionString: DATABASE_URL });
