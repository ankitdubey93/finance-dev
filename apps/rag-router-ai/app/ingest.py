"""Startup ingest: backfill embeddings for seeded documents.

The seed inserts document text with a NULL embedding. On startup we embed any
un-embedded rows via Gemini and write the vectors back, so the pgvector search
works on first query. Idempotent — already-embedded rows are skipped.
"""

from __future__ import annotations

import base64
import logging
import uuid

from .chunking import chunk_text
from .config import get_settings
from .db import connection
from .embeddings import embed_document
from .extract import extract_text
from .models import IngestRequest, KnowledgeSource

logger = logging.getLogger("rag-router-ai.ingest")


def backfill_embeddings() -> int:
    schema = get_settings().db_schema
    embedded = 0
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"SELECT id, title, content FROM {schema}.documents "
                "WHERE embedding IS NULL ORDER BY id"
            )
            pending = cur.fetchall()

        for doc_id, title, content in pending:
            # Embed title + body so the clause type contributes to the match.
            vector = embed_document(f"{title}\n\n{content}")
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {schema}.documents SET embedding = %s::vector WHERE id = %s",
                    (str(vector), doc_id),
                )
            embedded += 1
        conn.commit()

    if embedded:
        logger.info("Backfilled embeddings for %d document(s).", embedded)
    else:
        logger.info("No documents needed embedding.")
    return embedded


# ── User-uploaded knowledge sources (per-company) ────────────────────────────


class IngestError(ValueError):
    """Raised when an upload has no usable text."""


def ingest_source(req: IngestRequest) -> KnowledgeSource:
    """Extract → chunk → embed → store one uploaded source under a company.

    Every chunk is one `documents` row; they share a `source_id` so the
    Knowledge tab lists and deletes per source, not per chunk.
    """
    if req.file_base64:
        raw = base64.b64decode(req.file_base64)
        text = extract_text(raw, req.file_name, req.mime_type)
    else:
        text = (req.content or "").strip()

    chunks = chunk_text(text)
    if not chunks:
        raise IngestError("No extractable text found in the uploaded source.")

    schema = get_settings().db_schema
    source_id = uuid.uuid4()

    with connection() as conn:
        for chunk in chunks:
            vector = embed_document(f"{req.title}\n\n{chunk}")
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {schema}.documents "
                    "(company_id, source_id, title, doc_type, content, embedding) "
                    "VALUES (%s, %s, %s, %s, %s, %s::vector)",
                    (
                        req.company_id,
                        str(source_id),
                        req.title,
                        req.doc_type,
                        chunk,
                        str(vector),
                    ),
                )
        conn.commit()

    logger.info(
        "Ingested source '%s' (%d chunks) for company %s.",
        req.title,
        len(chunks),
        req.company_id,
    )
    return _fetch_source(req.company_id, str(source_id))


def list_sources(company_id: str) -> list[KnowledgeSource]:
    schema = get_settings().db_schema
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT source_id,
                       MIN(title)         AS title,
                       MIN(doc_type)      AS doc_type,
                       COUNT(*)           AS chunks,
                       MIN(created_at)    AS created_at
                FROM {schema}.documents
                WHERE company_id = %s
                GROUP BY source_id
                ORDER BY MIN(created_at) DESC
                """,
                (company_id,),
            )
            rows = cur.fetchall()
    return [_row_to_source(r) for r in rows]


def delete_source(company_id: str, source_id: str) -> bool:
    schema = get_settings().db_schema
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"DELETE FROM {schema}.documents "
                "WHERE company_id = %s AND source_id = %s",
                (company_id, source_id),
            )
            deleted = cur.rowcount
        conn.commit()
    return deleted > 0


def _fetch_source(company_id: str, source_id: str) -> KnowledgeSource:
    schema = get_settings().db_schema
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT source_id, MIN(title), MIN(doc_type),
                       COUNT(*), MIN(created_at)
                FROM {schema}.documents
                WHERE company_id = %s AND source_id = %s
                GROUP BY source_id
                """,
                (company_id, source_id),
            )
            row = cur.fetchone()
    return _row_to_source(row)


def _row_to_source(row: tuple) -> KnowledgeSource:
    source_id, title, doc_type, chunks, created_at = row
    return KnowledgeSource(
        id=str(source_id),
        title=title,
        docType=doc_type,
        chunks=int(chunks),
        createdAt=created_at.isoformat(),
    )
