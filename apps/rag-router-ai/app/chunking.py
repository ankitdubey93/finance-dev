"""Lightweight text chunker for knowledge ingestion.

Splits on blank lines (paragraph-aware), then packs paragraphs into windows of
roughly `size` characters with a small `overlap` so context isn't lost across
chunk boundaries. Kept dependency-free — good enough for demo-scale documents.
"""

from __future__ import annotations

import re


def chunk_text(text: str, size: int = 1200, overlap: int = 150) -> list[str]:
    cleaned = text.strip()
    if not cleaned:
        return []

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", cleaned) if p.strip()]

    chunks: list[str] = []
    current = ""
    for para in paragraphs:
        candidate = f"{current}\n\n{para}" if current else para
        if len(candidate) <= size:
            current = candidate
            continue
        if current:
            chunks.append(current)
        # A single paragraph longer than `size` is hard-split below.
        if len(para) <= size:
            current = para
        else:
            chunks.extend(_split_long(para, size, overlap))
            current = ""
    if current:
        chunks.append(current)

    return _apply_overlap(chunks, overlap)


def _split_long(text: str, size: int, overlap: int) -> list[str]:
    step = max(size - overlap, 1)
    return [text[i : i + size] for i in range(0, len(text), step)]


def _apply_overlap(chunks: list[str], overlap: int) -> list[str]:
    """Prepend the tail of each previous chunk to the next for continuity."""
    if overlap <= 0 or len(chunks) <= 1:
        return chunks
    out = [chunks[0]]
    for prev, cur in zip(chunks, chunks[1:]):
        tail = prev[-overlap:]
        out.append(f"{tail}\n\n{cur}" if tail else cur)
    return out
