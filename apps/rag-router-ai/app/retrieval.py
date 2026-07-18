"""The two retrieval paths behind the router.

  • vector_search — pgvector cosine similarity over contract clauses.
  • text_to_sql   — Claude writes SQL; it runs against the READ-ONLY role only.

RAG guardrail (CLAUDE.md §2/§9): hard numbers ALWAYS go through Text-to-SQL
against relational tables — never computed in the vector layer.
"""

from __future__ import annotations

import json
import re

import psycopg
from langchain_community.utilities import SQLDatabase
from psycopg.rows import dict_row

from .config import get_settings
from .db import connection
from .embeddings import embed_query
from .llm import get_client
from .models import VectorSource

# ── Vector path ─────────────────────────────────────────────────────────────


def vector_search(query: str, company_id: str, k: int = 4) -> list[VectorSource]:
    """Cosine search scoped to ONE company's knowledge (tenant isolation)."""
    schema = get_settings().db_schema
    qvec = str(embed_query(query))
    with connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                SELECT title,
                       doc_type,
                       content,
                       1 - (embedding <=> %s::vector) AS score
                FROM {schema}.documents
                WHERE embedding IS NOT NULL
                  AND company_id = %s
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (qvec, company_id, qvec, k),
            )
            rows = cur.fetchall()

    return [
        VectorSource(
            title=title,
            docType=doc_type,
            snippet=content,
            score=round(float(score), 4),
        )
        for (title, doc_type, content, score) in rows
    ]


# ── Text-to-SQL path ────────────────────────────────────────────────────────

_SQL_SYSTEM = """You are a Text-to-SQL engine for a PostgreSQL finance database.

Write a SINGLE read-only SELECT query (Postgres dialect) that answers the user's
question using ONLY the tables described below. Rules:
- SELECT statements only. No INSERT/UPDATE/DELETE/DDL of any kind.
- Schema-qualify every table (e.g. rag_router.transactions).
- Prefer explicit aggregates and clear column aliases so results render well.
- Amounts are USD in `amount_usd`. `direction` is 'inflow' or 'outflow'.

{table_info}"""

_SQL_SCHEMA = {
    "type": "object",
    "properties": {"sql": {"type": "string"}},
    "required": ["sql"],
    "additionalProperties": False,
}

_readonly_db: SQLDatabase | None = None


def _get_readonly_db() -> SQLDatabase:
    """LangChain SQLDatabase over the READ-ONLY role — thin glue for schema
    introspection. Query execution also uses the read-only connection below."""
    global _readonly_db
    if _readonly_db is None:
        settings = get_settings()
        _readonly_db = SQLDatabase.from_uri(
            _sqlalchemy_uri(settings.rag_router_readonly_url),
            schema=settings.db_schema,
            include_tables=["counterparties", "transactions"],
            sample_rows_in_table_info=3,
        )
    return _readonly_db


def _sqlalchemy_uri(uri: str) -> str:
    """SQLAlchemy defaults `postgresql://` to the psycopg2 driver; we ship
    psycopg v3, so pin the v3 dialect explicitly."""
    if uri.startswith("postgresql+"):
        return uri
    if uri.startswith("postgresql://"):
        return "postgresql+psycopg://" + uri[len("postgresql://") :]
    if uri.startswith("postgres://"):
        return "postgresql+psycopg://" + uri[len("postgres://") :]
    return uri


def _generate_sql(query: str) -> str:
    settings = get_settings()
    table_info = _get_readonly_db().get_table_info()
    resp = get_client().messages.create(
        model=settings.rag_router_synth_model,
        max_tokens=1024,
        system=_SQL_SYSTEM.format(table_info=table_info),
        output_config={"format": {"type": "json_schema", "schema": _SQL_SCHEMA}},
        messages=[{"role": "user", "content": query}],
    )
    text = next(b.text for b in resp.content if b.type == "text")
    return json.loads(text)["sql"].strip()


def _assert_read_only(sql: str) -> None:
    """Defense in depth beyond the read-only role: reject anything non-SELECT."""
    stripped = sql.strip().rstrip(";").strip()
    if not re.match(r"(?is)^\s*(select|with)\b", stripped):
        raise ValueError("Generated SQL is not a read-only SELECT.")
    forbidden = r"(?is)\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy)\b"
    if re.search(forbidden, stripped):
        raise ValueError("Generated SQL contains a forbidden write/DDL keyword.")


def text_to_sql(query: str) -> tuple[str, list[dict]]:
    """Return (generated_sql, rows). Executes on the read-only connection."""
    sql = _generate_sql(query)
    _assert_read_only(sql)

    settings = get_settings()
    with psycopg.connect(settings.rag_router_readonly_url, row_factory=dict_row) as conn:
        conn.read_only = True  # belt and braces on the session itself
        with conn.cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()

    # Normalize non-JSON-native types (Decimal, date) for the API boundary.
    return sql, [_jsonable(r) for r in rows]


def _jsonable(row: dict) -> dict:
    out: dict = {}
    for key, value in row.items():
        if hasattr(value, "isoformat"):
            out[key] = value.isoformat()
        elif isinstance(value, (int, float, str, bool)) or value is None:
            out[key] = value
        else:
            out[key] = float(value) if _is_number(value) else str(value)
    return out


def _is_number(value: object) -> bool:
    try:
        float(value)  # type: ignore[arg-type]
        return True
    except (TypeError, ValueError):
        return False
