"""Shared Anthropic client (routing + synthesis)."""

from __future__ import annotations

from functools import lru_cache

import anthropic

from .config import get_settings


@lru_cache
def get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=get_settings().anthropic_api_key)
