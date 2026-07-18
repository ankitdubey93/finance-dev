"""Runtime configuration, loaded from environment (secrets never hard-coded)."""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", case_sensitive=False)

    # Service
    rag_router_ai_port: int = 8101

    # Database — app role (read/write) for vector search + embedding backfill.
    database_url: str = "postgresql://finance:finance@db:5432/finance"
    # Read-only role — used ONLY for Text-to-SQL so generated SQL can't mutate.
    rag_router_readonly_url: str = "postgresql://rag_readonly:rag_readonly@db:5432/finance"

    # LLM providers (this service is the only process that sees these keys).
    anthropic_api_key: str = ""
    gemini_api_key: str = ""

    # Models
    rag_router_route_model: str = "claude-haiku-4-5"
    rag_router_synth_model: str = "claude-opus-4-8"
    rag_router_embed_model: str = "gemini-embedding-001"
    rag_router_embed_dim: int = 768

    db_schema: str = "rag_router"


@lru_cache
def get_settings() -> Settings:
    return Settings()
