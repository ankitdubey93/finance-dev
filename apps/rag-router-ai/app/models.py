"""Pydantic contracts — mirror libs/types (TS) on the Python side."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

RagRoute = Literal["vector", "sql", "hybrid"]


class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1)
    # Tenant scope: the vector path filters documents by this company. Forwarded
    # from the gateway's X-Company-Id header by rag-router-api.
    company_id: str = Field(..., min_length=1)


class IngestRequest(BaseModel):
    """Upload one knowledge source: either pasted `content` or a base64 file."""

    company_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    doc_type: str = "text"
    content: str | None = None
    file_base64: str | None = None
    file_name: str | None = None
    mime_type: str | None = None


class KnowledgeSource(BaseModel):
    id: str
    title: str
    docType: str
    chunks: int
    createdAt: str


class RouteDecision(BaseModel):
    route: RagRoute
    reasoning: str


class VectorSource(BaseModel):
    title: str
    docType: str
    snippet: str
    score: float


class QueryResponse(BaseModel):
    answer: str
    route: RagRoute
    reasoning: str
    sources: list[VectorSource] = []
    rows: list[dict] = []
    sql: str | None = None
