"""
Central configuration for Gyan Sarthi backend.

All secrets are read from environment variables (via a local .env file in
development). Nothing here should ever contain a real API key.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


def _require(name: str, default: str | None = None) -> str:
    val = os.getenv(name, default)
    if val is None:
        raise RuntimeError(
            f"Missing required environment variable: {name}. "
            f"Copy .env.example to .env and fill it in."
        )
    return val


@dataclass(frozen=True)
class Settings:
    # --- Gemini (LLM: quiz generation, RAG answers, feedback, domain tagging) ---
    # Free tier via Google AI Studio (aistudio.google.com/apikey) — no credit
    # card needed. gemini-2.5-flash has free input/output tokens as of the
    # official pricing page; swap GEMINI_MODEL if Google ships a newer
    # default (e.g. gemini-3.8-flash) with a better free allotment later.
    gemini_api_key: str
    gemini_model: str = "gemini-2.5-flash"

    # --- Pinecone (vector database) ---
    pinecone_api_key: str = ""
    pinecone_index_name: str = "gyan-sarthi-content"
    # Pinecone's hosted "integrated inference" embedding model. Using an
    # integrated model means we never have to call a separate embeddings
    # API or manage embedding dimensions ourselves — Pinecone embeds text
    # on upsert and on query with the same model automatically.
    pinecone_embedding_model: str = "multilingual-e5-large"
    pinecone_cloud: str = "aws"
    pinecone_region: str = "us-east-1"

    # --- Chunking ---
    chunk_size_tokens: int = 350
    chunk_overlap_tokens: int = 60

    # --- Retrieval ---
    default_top_k: int = 5

    # --- Storage (demo persistence; swap for MongoDB Atlas in production) ---
    data_dir: str = os.path.join(os.path.dirname(__file__), "..", "storage")


def get_settings() -> Settings:
    """
    Load settings lazily so the module can be imported (e.g. for docs or
    tests) even when environment variables are not yet configured.
    """
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        pinecone_api_key=os.getenv("PINECONE_API_KEY", ""),
        pinecone_index_name=os.getenv("PINECONE_INDEX_NAME", "gyan-sarthi-content"),
        pinecone_embedding_model=os.getenv(
            "PINECONE_EMBEDDING_MODEL", "multilingual-e5-large"
        ),
        pinecone_cloud=os.getenv("PINECONE_CLOUD", "aws"),
        pinecone_region=os.getenv("PINECONE_REGION", "us-east-1"),
    )
