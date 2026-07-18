-- Seed: one coherent story so every demo query lands.
--
-- Fictional firm "Northwind Capital" and its 2025 counterparty activity:
--   • counterparties + transactions  → quantitative (Text-to-SQL)
--   • contract clauses in `documents` → qualitative (pgvector)
-- Embeddings are left NULL here; rag-router-ai backfills them on startup.

INSERT INTO rag_router.counterparties (name, sector) VALUES
  ('Acme Logistics',  'Transportation'),
  ('Vertex Cloud',    'Technology'),
  ('Meridian Bank',   'Financial Services'),
  ('Solaris Energy',  'Energy'),
  ('Harbor Foods',    'Consumer Goods');

-- Transactions across all four quarters of 2025. Mix of inflows (revenue) and
-- outflows (costs) so volume, P&L, and per-counterparty questions all work.
INSERT INTO rag_router.transactions (txn_date, counterparty_id, direction, category, amount_usd) VALUES
  -- Q1 2025
  ('2025-01-14', 1, 'inflow',  'Freight settlement',   420000.00),
  ('2025-02-03', 2, 'outflow', 'Cloud infrastructure', 128500.00),
  ('2025-02-20', 3, 'inflow',  'Interest income',       76500.00),
  ('2025-03-11', 4, 'outflow', 'Energy supply',        215000.00),
  ('2025-03-29', 5, 'inflow',  'Distribution revenue', 312000.00),
  -- Q2 2025
  ('2025-04-08', 1, 'inflow',  'Freight settlement',   455000.00),
  ('2025-04-22', 2, 'outflow', 'Cloud infrastructure', 131200.00),
  ('2025-05-06', 3, 'inflow',  'Advisory fees',        189000.00),
  ('2025-05-19', 4, 'outflow', 'Energy supply',        228400.00),
  ('2025-06-02', 5, 'inflow',  'Distribution revenue', 298750.00),
  ('2025-06-27', 2, 'outflow', 'Cloud infrastructure', 140000.00),
  -- Q3 2025
  ('2025-07-09', 1, 'inflow',  'Freight settlement',   501000.00),
  ('2025-07-24', 3, 'inflow',  'Interest income',       84250.00),
  ('2025-08-05', 4, 'outflow', 'Energy supply',        241900.00),
  ('2025-08-18', 5, 'inflow',  'Distribution revenue', 355600.00),
  ('2025-09-01', 2, 'outflow', 'Cloud infrastructure', 146300.00),
  ('2025-09-16', 1, 'inflow',  'Freight settlement',   478900.00),
  -- Q4 2025
  ('2025-10-07', 3, 'inflow',  'Advisory fees',        204500.00),
  ('2025-10-21', 4, 'outflow', 'Energy supply',        237750.00),
  ('2025-11-04', 5, 'inflow',  'Distribution revenue', 366200.00),
  ('2025-11-25', 2, 'outflow', 'Cloud infrastructure', 152800.00),
  ('2025-12-09', 1, 'inflow',  'Freight settlement',   523400.00),
  ('2025-12-22', 3, 'inflow',  'Interest income',       91300.00);

-- Contract clauses — the qualitative corpus. Each references a real counterparty
-- so hybrid questions ("what does Vertex Cloud's SLA say, and how much did we
-- pay them?") can pull from both sides. All belong to the seeded Northwind
-- Capital company (company_id fixed in 05_platform_schema.sql); each clause is
-- its own source (distinct source_id). Embeddings are backfilled on AI startup.
INSERT INTO rag_router.documents (company_id, source_id, title, doc_type, content) VALUES
  ('00000000-0000-0000-0000-0000000000a1', gen_random_uuid(),
   'Acme Logistics — Master Services Agreement, Termination',
   'termination_clause',
   'Either party may terminate this Agreement for convenience upon ninety (90) days'' prior written notice. Northwind Capital may terminate immediately for cause if Acme Logistics fails to deliver freight settlement reconciliations for two consecutive months. Upon termination, all outstanding freight settlements become due within thirty (30) days.'),

  ('00000000-0000-0000-0000-0000000000a1', gen_random_uuid(),
   'Vertex Cloud — Service Level Agreement',
   'sla_clause',
   'Vertex Cloud guarantees 99.95% monthly uptime for production infrastructure. Any calendar month falling below 99.5% entitles Northwind Capital to a service credit equal to 15% of that month''s cloud infrastructure fees. Credits are the sole remedy for availability failures and do not apply to scheduled maintenance windows notified 72 hours in advance.'),

  ('00000000-0000-0000-0000-0000000000a1', gen_random_uuid(),
   'Meridian Bank — Advisory Engagement, Payment Terms',
   'payment_terms_clause',
   'Advisory fees are invoiced quarterly in arrears and payable net thirty (30) days. Late payments accrue interest at 1.5% per month. Interest income arrangements are governed separately under the Deposit Facility Schedule and settle on the final business day of each quarter.'),

  ('00000000-0000-0000-0000-0000000000a1', gen_random_uuid(),
   'Solaris Energy — Supply Agreement, Indemnification',
   'indemnification_clause',
   'Solaris Energy shall indemnify and hold Northwind Capital harmless from any liability arising out of supply interruptions caused by Solaris''s negligence. Indemnification is capped at the total energy supply charges paid in the twelve (12) months preceding the claim, and excludes consequential or punitive damages.'),

  ('00000000-0000-0000-0000-0000000000a1', gen_random_uuid(),
   'Harbor Foods — Distribution Agreement, Confidentiality',
   'confidentiality_clause',
   'Each party shall keep confidential all pricing, volume, and distribution revenue data disclosed under this Agreement for a period of five (5) years following disclosure. Confidential information may be shared with auditors and regulators on a need-to-know basis, provided equivalent confidentiality obligations are imposed.'),

  ('00000000-0000-0000-0000-0000000000a1', gen_random_uuid(),
   'Vertex Cloud — Master Agreement, Data Processing',
   'data_processing_clause',
   'Vertex Cloud processes Northwind Capital data solely to provide the contracted services and shall not retain, use, or disclose such data for any other purpose. Upon termination, Vertex Cloud shall delete or return all customer data within sixty (60) days and certify deletion in writing.');
