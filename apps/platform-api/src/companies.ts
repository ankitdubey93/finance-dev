// Companies (tenants) CRUD — a cross-cutting platform concern, so it lives in
// the gateway, not in any tool. Mounts its OWN json body parser; the router is
// registered before the /api/tools proxy, which must keep streaming raw bodies.

import { Router } from 'express';
import express from 'express';
import type { Company, CreateCompanyRequest } from '@finance-dev/types';
import { pool } from './db.js';

export const companiesRouter: Router = Router();

// Body parser scoped to this router only (never global — see main.ts).
companiesRouter.use('/api/companies', express.json());

function rowToCompany(row: {
  id: string;
  name: string;
  slug: string;
  created_at: Date;
}): Company {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at.toISOString(),
  };
}

/** Turn a display name into a URL-safe, reasonably unique slug. */
function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const safe = base || 'company';
  // Short suffix keeps the UNIQUE(slug) constraint from colliding on same names.
  return `${safe}-${Math.random().toString(36).slice(2, 6)}`;
}

companiesRouter.get('/api/companies', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, slug, created_at FROM platform.companies ORDER BY created_at DESC',
    );
    res.json({ companies: rows.map(rowToCompany) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list companies', detail: String(err) });
  }
});

companiesRouter.post('/api/companies', async (req, res) => {
  const body = req.body as Partial<CreateCompanyRequest>;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: 'Body must include a non-empty "name".' });
    return;
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO platform.companies (name, slug) VALUES ($1, $2) RETURNING id, name, slug, created_at',
      [name, slugify(name)],
    );
    res.status(201).json({ company: rowToCompany(rows[0]) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create company', detail: String(err) });
  }
});

companiesRouter.delete('/api/companies/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM platform.companies WHERE id = $1',
      [req.params.id],
    );
    if (rowCount === 0) {
      res.status(404).json({ error: 'Company not found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete company', detail: String(err) });
  }
});
