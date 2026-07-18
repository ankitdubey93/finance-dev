"""Gemini embeddings for the pgvector layer.

Anthropic has no embeddings API, so the second key (Gemini) does the embedding
work while Claude handles routing + synthesis.
"""

from __future__ import annotations

import google.generativeai as genai

from .config import get_settings

_configured = False


def _ensure_configured() -> None:
    global _configured
    if not _configured:
        settings = get_settings()
        genai.configure(api_key=settings.gemini_api_key)
        _configured = True


def _model_name() -> str:
    # Gemini expects the "models/" prefix.
    name = get_settings().rag_router_embed_model
    return name if name.startswith("models/") else f"models/{name}"


def embed_query(text: str) -> list[float]:
    """Embed a search query (asymmetric: RETRIEVAL_QUERY task)."""
    _ensure_configured()
    result = genai.embed_content(
        model=_model_name(),
        content=text,
        task_type="RETRIEVAL_QUERY",
        output_dimensionality=get_settings().rag_router_embed_dim,
    )
    return result["embedding"]


def embed_document(text: str) -> list[float]:
    """Embed a stored document (asymmetric: RETRIEVAL_DOCUMENT task)."""
    _ensure_configured()
    result = genai.embed_content(
        model=_model_name(),
        content=text,
        task_type="RETRIEVAL_DOCUMENT",
        output_dimensionality=get_settings().rag_router_embed_dim,
    )
    return result["embedding"]
