"""The routing decision — the heart of the demo.

Classifies a natural-language finance question as:
  • vector — qualitative (contract clauses, policy text)
  • sql    — quantitative (hard numbers: volumes, totals, P&L)
  • hybrid — needs both a qualitative summary AND numbers

Uses a fast, cheap Claude model with structured output so the decision (and its
reasoning) is returned as clean JSON we can surface directly in the UI.
"""

from __future__ import annotations

import json

from .config import get_settings
from .llm import get_client
from .models import RouteDecision

_SYSTEM = """You are the routing brain of an Agentic RAG Router for financial data.

Classify the user's question into exactly one route:
- "vector": qualitative questions answered from unstructured contract/policy TEXT
  (e.g. "what does the termination clause say?", "summarize the SLA").
- "sql": quantitative questions needing HARD NUMBERS from relational finance
  tables (e.g. "total transaction volume in Q3?", "net cash flow by counterparty?").
- "hybrid": questions that need BOTH a text summary and computed numbers
  (e.g. "what's Vertex Cloud's SLA, and how much did we pay them in 2025?").

Critical rule: any question requiring arithmetic, aggregation, totals, or other
hard numbers MUST use "sql" (or "hybrid") — never answer numbers from text.

Respond with the routing decision and a one-sentence justification."""

_SCHEMA = {
    "type": "object",
    "properties": {
        "route": {"type": "string", "enum": ["vector", "sql", "hybrid"]},
        "reasoning": {"type": "string"},
    },
    "required": ["route", "reasoning"],
    "additionalProperties": False,
}


def classify(query: str) -> RouteDecision:
    settings = get_settings()
    resp = get_client().messages.create(
        model=settings.rag_router_route_model,
        max_tokens=512,
        system=_SYSTEM,
        output_config={"format": {"type": "json_schema", "schema": _SCHEMA}},
        messages=[{"role": "user", "content": query}],
    )
    text = next(b.text for b in resp.content if b.type == "text")
    data = json.loads(text)
    return RouteDecision(**data)
