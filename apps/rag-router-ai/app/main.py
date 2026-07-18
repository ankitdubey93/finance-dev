"""FastAPI service for the Agentic RAG Router (isolated tool AI service).

Endpoints:
  GET  /health  — liveness
  POST /route   — routing decision only (vector | sql | hybrid)
  POST /query   — orchestrated answer (route → retrieve → synthesize)
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from .db import close_pool
from .ingest import (
    IngestError,
    backfill_embeddings,
    delete_source,
    ingest_source,
    list_sources,
)
from .models import (
    IngestRequest,
    KnowledgeSource,
    QueryRequest,
    QueryResponse,
    RouteDecision,
)
from .retrieval import text_to_sql, vector_search
from .router import classify
from .synthesis import synthesize

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rag-router-ai")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Backfill document embeddings so the vector path works on first query.
    try:
        backfill_embeddings()
    except Exception:  # noqa: BLE001 — don't crash the service if Gemini is down
        logger.exception("Embedding backfill failed; vector search may be empty.")
    yield
    close_pool()


app = FastAPI(title="rag-router-ai", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "rag-router-ai"}


@app.post("/route", response_model=RouteDecision)
def route(req: QueryRequest) -> RouteDecision:
    return classify(req.query)


@app.post("/query", response_model=QueryResponse)
def query(req: QueryRequest) -> QueryResponse:
    decision = classify(req.query)

    sources = []
    rows: list[dict] = []
    sql: str | None = None

    # For hybrid, run both retrieval paths in parallel (CLAUDE.md data flow).
    # Vector search is scoped to the requesting company (tenant isolation).
    if decision.route == "vector":
        sources = vector_search(req.query, req.company_id)
    elif decision.route == "sql":
        sql, rows = text_to_sql(req.query)
    else:  # hybrid
        with ThreadPoolExecutor(max_workers=2) as pool:
            vec_future = pool.submit(vector_search, req.query, req.company_id)
            sql_future = pool.submit(text_to_sql, req.query)
            sources = vec_future.result()
            sql, rows = sql_future.result()

    answer = synthesize(req.query, decision.route, sources, rows, sql)

    return QueryResponse(
        answer=answer,
        route=decision.route,
        reasoning=decision.reasoning,
        sources=sources,
        rows=rows,
        sql=sql,
    )


# ── Knowledge sources (per-company upload / list / delete) ───────────────────


@app.post("/ingest", response_model=KnowledgeSource)
def ingest(req: IngestRequest) -> KnowledgeSource:
    try:
        return ingest_source(req)
    except IngestError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/documents", response_model=list[KnowledgeSource])
def documents(company_id: str) -> list[KnowledgeSource]:
    return list_sources(company_id)


@app.delete("/documents/{source_id}")
def remove_document(source_id: str, company_id: str) -> dict:
    if not delete_source(company_id, source_id):
        raise HTTPException(status_code=404, detail="Source not found")
    return {"deleted": source_id}
