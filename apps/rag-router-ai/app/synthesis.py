"""Synthesis: merge the qualitative summary and the SQL result into one answer.

Synthesis happens only AFTER both streams return (CLAUDE.md §2). The model is
told to trust the SQL rows for any number and never invent figures.
"""

from __future__ import annotations

import json

from .config import get_settings
from .llm import get_client
from .models import RagRoute, VectorSource

_SYSTEM = """You are the answer synthesizer for an Agentic RAG Router in the
financial domain. You are given a user question plus evidence gathered for it:
qualitative CONTRACT SNIPPETS (from semantic search) and/or a SQL RESULT (hard
numbers from relational tables).

Write one clear, concise answer for a finance professional. Rules:
- For any number, use the SQL RESULT verbatim — never estimate or invent figures.
- Ground qualitative claims in the contract snippets; don't fabricate clauses.
- If evidence is missing for part of the question, say so plainly.
- Be direct: lead with the answer, then the brief supporting detail."""


def synthesize(
    query: str,
    route: RagRoute,
    sources: list[VectorSource],
    rows: list[dict],
    sql: str | None,
) -> str:
    settings = get_settings()

    evidence_parts: list[str] = [f"USER QUESTION:\n{query}\n"]
    if sources:
        snippets = "\n\n".join(
            f"[{s.title} — {s.docType}] (similarity {s.score})\n{s.snippet}"
            for s in sources
        )
        evidence_parts.append(f"CONTRACT SNIPPETS:\n{snippets}\n")
    if sql is not None:
        evidence_parts.append(f"SQL QUERY:\n{sql}\n")
        evidence_parts.append(f"SQL RESULT (JSON rows):\n{json.dumps(rows, indent=2)}\n")

    resp = get_client().messages.create(
        model=settings.rag_router_synth_model,
        max_tokens=1024,
        thinking={"type": "adaptive"},
        output_config={"effort": "medium"},
        system=_SYSTEM,
        messages=[{"role": "user", "content": "\n".join(evidence_parts)}],
    )
    return next(b.text for b in resp.content if b.type == "text")
