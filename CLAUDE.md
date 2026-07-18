# CLAUDE.md

Guidance for Claude Code (and humans) working in this repository.

---

## 1. Overview

This is a **monorepo of finance + technology demo tools**, built by us as a
consultancy/agency to **showcase** what we can deliver for clients. It is not a
single product — it is a **portfolio**.

The platform has two conceptual layers:

- **The shell (platform):** a dashboard that lists every tool as a **card**.
  Clicking a card opens that tool.
- **The tools:** each tool behaves as a **standalone app** mounted under its own
  route, with its **own isolated backend and AI service**. Tools do not know
  about each other.

The **first tool** is an **Agentic RAG Router** for the financial sector: it
intercepts a natural-language query and routes it to either **pgvector semantic
search** (unstructured text, e.g. a contract clause) or **Text-to-SQL** (hard
numbers, e.g. transaction volume), then **synthesizes** both into one answer.

> **North star:** every tool must run as a self-contained demo, yet share the
> same shell, look, and conventions so the portfolio feels like one product.

---

## 2. Architecture

Two tiers: a **thin shared platform** and **fully isolated tool stacks**.

- **Platform (shared, thin):**
  - `apps/web` — the Vite React SPA shell (dashboard + all tool UIs).
  - `apps/platform-api` — Express gateway. Owns **only** cross-cutting concerns:
    **auth, sessions, the tool registry**, and **reverse-proxying**
    `/api/tools/:slug/*` to the correct tool service so the SPA sees one origin.
- **Per tool (isolated):**
  - `<slug>-api` — the tool's **own** Express backend.
  - `<slug>-ai` — the tool's **own** FastAPI (Python) service for
    LangChain/LlamaIndex orchestration.
  - a dedicated **Postgres schema** (`<slug>`), never shared with other tools.

**Golden rule of isolation:** a tool never imports another tool's code and never
reads another tool's DB schema. The platform layer is the *only* shared surface.

### Query data flow (RAG Router example)

```
User (chat UI in apps/web)
  → POST /api/tools/rag-router/query        (platform-api: auth + proxy)
    → POST rag-router-api /query            (tool Node backend)
      → POST rag-router-ai /route           (FastAPI: routing decision)
      → route == "vector"  → pgvector semantic search (schema: rag_router)
      → route == "sql"     → Text-to-SQL → relational tables (schema: rag_router)
      → route == "hybrid"  → both, in parallel
      → synthesize vector summary + SQL result into one answer
    ← unified answer + structured rows for dashboard rendering
  ← chat message + dynamic table/chart
```

> **RAG guardrail:** never compute financial math in the vector layer. Vectors
> answer *qualitative* questions; **hard numbers always go through Text-to-SQL**
> against relational tables. Synthesis happens only after both streams return.

---

## 3. Tech stack

| Layer            | Choice                                                        |
| ---------------- | ------------------------------------------------------------- |
| Monorepo         | **Nx** with **pnpm** workspaces                               |
| Frontend         | **React + Vite + TypeScript** (single SPA shell), TailwindCSS |
| Platform gateway | **Node.js + Express + TypeScript**                            |
| Tool backend     | **Node.js + Express + TypeScript** (one per tool)             |
| Tool AI service  | **Python + FastAPI + Pydantic**, LangChain / LlamaIndex       |
| Database         | **PostgreSQL + pgvector** (single instance, per-tool schemas) |
| Infra            | **Docker + Docker Compose**                                   |

- **TypeScript everywhere** on the JS side; **strict** mode on.
- Python services are typed via **Pydantic** models and type hints.
- Nx is TS-native; the Python `*-ai` services are wired in via **`@nxlv/python`**
  (or a `run-commands` target) and are first-class in `docker-compose`.

---

## 4. Repo layout

```
root/
  nx.json  pnpm-workspace.yaml  tsconfig.base.json
  docker-compose.yml  .env.example
  apps/
    web/                 # Vite React SPA shell — dashboard + all tool UIs, routed
    platform-api/        # Express (TS): auth, sessions, /api/registry, proxy to tools
    rag-router-api/      # Express (TS): RAG Router's OWN Node backend (isolated)
    rag-router-ai/       # FastAPI (Python): routing + synthesis (isolated)
  libs/                  # shared code (Nx-idiomatic)
    types/               # shared TS API contracts / DTOs (FE <-> platform-api)
    ui/                  # shared React components: ToolCard, ChatPanel, DataTable, ChartPanel
    tool-registry/       # tool manifest (slug, name, desc, icon, route, status)
    config/              # eslint / tsconfig / tailwind presets
  infra/
    db/                  # Postgres + pgvector init, per-tool schema migrations, seeds
    docker/              # per-service Dockerfiles
```

- **`apps/`** — runnable processes (shell, gateway, and each tool's services).
- **`libs/`** — shared, importable code. **Only the platform and cross-tool
  primitives live here.** Tool-specific logic stays inside that tool's app.
- **`libs/tool-registry`** is the source of truth for what tools exist. It drives
  both the dashboard cards and the gateway's proxy table.

---

## 5. Routing & namespacing conventions

**A tool's slug is its namespace across every layer.** For slug `rag-router`:

| Layer            | Convention                                                        |
| ---------------- | ----------------------------------------------------------------- |
| Frontend route   | `/tools/rag-router/*`                                              |
| Frontend code    | `apps/web/src/tools/rag-router/`                                   |
| Gateway route    | `/api/tools/rag-router/*` (proxied)                               |
| Node service     | `rag-router-api`                                                   |
| AI service       | `rag-router-ai`                                                    |
| Postgres schema  | `rag_router` (slug with `-` → `_`)                                |

### Frontend (SPA shell, `apps/web`)

- `/` → dashboard grid of tool cards (from `libs/tool-registry`)
- `/login`, `/auth/*` → auth screens
- `/tools/:slug/*` → the tool's standalone UI (chat pane + dashboards)

### Platform API (`platform-api`, gateway)

- `/api/auth/*` — login / session
- `/api/registry` — tool list for the dashboard
- `/api/tools/:slug/*` — reverse-proxy to that tool's `<slug>-api`

### Tool Node service (`rag-router-api`)

- `/query`, `/history`, `/documents` — domain endpoints; calls its own AI service

### Tool AI service (`rag-router-ai`, FastAPI)

- `/route` — routing decision (vector | sql | hybrid)
- `/query` — orchestrated answer (vector + Text-to-SQL + synthesis)
- `/health` — liveness

> Keep the slug identical everywhere. That single rule is what lets each tool be
> "standalone" while the shell stays generic.

---

## 6. Adding a new tool

1. **Pick a slug** — kebab-case, unique (e.g. `cashflow-forecaster`).
2. **Scaffold services** — `nx g` a `<slug>-api` (Express) and a `<slug>-ai`
   (FastAPI).
3. **Register it** — add the tool to `libs/tool-registry` with card metadata
   (name, description, icon, route, status).
4. **Add the UI** — create `apps/web/src/tools/<slug>/` and mount it at
   `/tools/<slug>/*`.
5. **Wire infra** — add `<slug>-api` / `<slug>-ai` services and a Postgres
   schema/migration in `docker-compose.yml` + `infra/db`.
6. **Done** — the gateway picks the tool up from the registry; the dashboard
   renders its card automatically.

---

## 7. Local development

```bash
pnpm install                     # install all JS deps
docker compose up -d db          # Postgres + pgvector
docker compose up                # all services (or scope to one tool below)

# Run selected apps in dev
nx run-many -t serve -p web platform-api rag-router-api
nx serve rag-router-ai           # FastAPI (via @nxlv/python target)

# Run just one tool's full stack
docker compose up db platform-api web rag-router-api rag-router-ai
```

- Copy `.env.example` → `.env`. Secrets (LLM API keys, DB creds, session secret)
  come from env, never hard-coded and never committed.
- The SPA talks only to `platform-api` (`/api/...`); it never calls a tool
  service directly.

---

## 8. Database conventions

- **One Postgres instance** with the **pgvector** extension enabled.
- **Per-tool schema isolation:** each tool owns schema `<slug>` (e.g.
  `rag_router`). A tool only touches its own schema.
- **Vectors live alongside relational tables** — embedding columns
  (`vector(n)`) sit in the same schema as the tool's structured financial
  tables. This is the whole point: qualitative and quantitative data co-located.
- **Migrations & seeds** live in `infra/db`, namespaced by tool.

---

## 9. Conventions & guardrails

- **TypeScript strict** on all JS packages; share request/response shapes through
  `libs/types` — do not redeclare DTOs per app.
- **No cross-tool imports** and **no cross-schema DB access.** Shared code goes
  in `libs/`; tool-specific code stays in the tool.
- **The SPA has one origin** (the gateway). Do not point the frontend at tool
  services directly.
- **Secrets in env only.** LLM keys are consumed by the `*-ai` services; the
  frontend never sees them.
- **RAG correctness:** route hard numbers to Text-to-SQL, qualitative questions
  to vector search; synthesize only after both return. Never fake math from the
  vector layer.
- **Demo quality bar:** these are client-facing showcases — polished UI,
  sensible empty/loading/error states, and seed data that tells a story.

---

## 10. First tool — Agentic RAG Router

**Goal:** solve the gap where pure vector RAG fails on financial tables and math.

**Responsibilities**

- **Intelligent routing** (`/route`) — classify a query as qualitative (vector),
  quantitative (SQL), or both (hybrid).
- **Vector search** — qualitative summaries over unstructured text (e.g. a
  contract clause) via pgvector.
- **Text-to-SQL** — translate number questions into SQL against the tool's
  relational tables (e.g. transaction volume, P&L).
- **Synthesis** (`/query`) — merge the text summary and the SQL result into one
  coherent answer, returning structured rows so the UI can render tables/charts.

**Surfaces**

- UI: `/tools/rag-router/*` — chat pane + a results dashboard (tables + charts).
- Gateway: `/api/tools/rag-router/*`
- Services: `rag-router-api` (Node) → `rag-router-ai` (FastAPI)
- DB schema: `rag_router` (relational finance tables + pgvector embeddings)
