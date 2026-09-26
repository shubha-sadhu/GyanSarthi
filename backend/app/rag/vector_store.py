"""
Vector store built on Pinecone, using Pinecone's *integrated inference*
embedding model.

Why integrated embeddings: Pinecone hosts the embedding model itself, so
upsert and query calls take raw text and Pinecone embeds it server-side
with the same model both times. This removes an entire separate
"embeddings" dependency (e.g. OpenAI embeddings) and guarantees the
query and the stored vectors can never drift out of the same embedding
space.

If you later want to swap in a different embedding provider (e.g. a
self-hosted sentence-transformers model for a fully offline deployment),
only `upsert_chunks` and `query` need to change — everything else in the
app talks to this module, not to Pinecone directly.
"""
from __future__ import annotations

from dataclasses import dataclass

from pinecone import Pinecone

from app.config import get_settings
from app.models import DocumentChunk

_pc: Pinecone | None = None


def _client() -> Pinecone:
    global _pc
    if _pc is None:
        settings = get_settings()
        if not settings.pinecone_api_key:
            raise RuntimeError("PINECONE_API_KEY is not set. Add it to your .env file.")
        _pc = Pinecone(api_key=settings.pinecone_api_key)
    return _pc


def ensure_index_exists() -> None:
    """Creates the index (with integrated embedding) if it doesn't exist yet."""
    settings = get_settings()
    pc = _client()
    existing = {idx["name"] for idx in pc.list_indexes()}
    if settings.pinecone_index_name in existing:
        return
    # create_index_for_model takes cloud/region directly — unlike
    # create_index, it does NOT take a spec= argument (an integrated-
    # embedding index is always serverless, so there's nothing to specify).
    pc.create_index_for_model(
        name=settings.pinecone_index_name,
        cloud=settings.pinecone_cloud,
        region=settings.pinecone_region,
        embed={
            "model": settings.pinecone_embedding_model,
            "field_map": {"text": "text"},
        },
    )


def _index():
    settings = get_settings()
    return _client().Index(settings.pinecone_index_name)


def upsert_chunks(chunks: list[DocumentChunk], namespace: str = "default") -> None:
    """
    Upserts chunks. Pinecone embeds `text` server-side (integrated
    inference) — we never compute or send a vector ourselves.
    """
    ensure_index_exists()
    records = [
        {
            "_id": chunk.chunk_id,
            "text": chunk.text,
            "document_id": chunk.document_id,
            "domain_id": chunk.domain_id,
            "title": chunk.title,
            "source_type": chunk.source_type.value,
            "page_or_slide": chunk.page_or_slide or 0,
        }
        for chunk in chunks
    ]
    index = _index()
    # Pinecone upsert_records batches internally; keep batches modest for large sets.
    for i in range(0, len(records), 96):
        index.upsert_records(namespace=namespace, records=records[i : i + 96])


@dataclass
class RetrievedChunk:
    chunk_id: str
    text: str
    document_id: str
    domain_id: str
    title: str
    score: float


def query(
    query_text: str,
    top_k: int = 5,
    domain_id: str | None = None,
    namespace: str = "default",
) -> list[RetrievedChunk]:
    """Semantic search, optionally filtered to a single competency domain."""
    index = _index()
    filter_ = {"domain_id": {"$eq": domain_id}} if domain_id else None
    result = index.search(
        namespace=namespace,
        query={
            "inputs": {"text": query_text},
            "top_k": top_k,
            "filter": filter_,
        },
    )
    hits = result.get("result", {}).get("hits", [])
    return [
        RetrievedChunk(
            chunk_id=hit["_id"],
            text=hit["fields"].get("text", ""),
            document_id=hit["fields"].get("document_id", ""),
            domain_id=hit["fields"].get("domain_id", ""),
            title=hit["fields"].get("title", ""),
            score=hit.get("_score", 0.0),
        )
        for hit in hits
    ]
