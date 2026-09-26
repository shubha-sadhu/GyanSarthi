"""
Ties together parsing, chunking, domain tagging, and vector-store upsert
into a single call: ingest_file(...) / ingest_transcript(...).
"""
from __future__ import annotations

from app.competency.framework import CompetencyFramework
from app.config import get_settings
from app.ingestion.chunker import chunk_units
from app.ingestion.document_parser import parse_document, parse_video_transcript
from app.ingestion.domain_tagger import tag_domain
from app.models import DocumentChunk, IngestedDocument, SourceType
from app.rag.vector_store import upsert_chunks
from app.storage import get_storage


def _ingest_units(
    title: str,
    source_type: SourceType,
    units,
    framework: CompetencyFramework,
    forced_domain_id: str | None,
) -> IngestedDocument:
    settings = get_settings()
    storage = get_storage()

    doc = IngestedDocument(title=title, source_type=source_type, domain_id=forced_domain_id or "")
    raw_chunks = chunk_units(
        units,
        chunk_size_tokens=settings.chunk_size_tokens,
        overlap_tokens=settings.chunk_overlap_tokens,
    )

    chunks: list[DocumentChunk] = []
    domain_tally: dict[str, int] = {}
    for order, (text, source_index) in enumerate(raw_chunks):
        domain_id = forced_domain_id or tag_domain(text, framework)
        domain_tally[domain_id] = domain_tally.get(domain_id, 0) + 1
        chunk = DocumentChunk(
            document_id=doc.document_id,
            source_type=source_type,
            domain_id=domain_id,
            title=title,
            text=text,
            page_or_slide=source_index,
            order=order,
        )
        chunks.append(chunk)

    if not forced_domain_id and domain_tally:
        doc.domain_id = max(domain_tally, key=domain_tally.get)

    doc.num_chunks = len(chunks)

    # Persist metadata, then embed + upsert into the vector index.
    storage.documents.insert(doc.model_dump())
    for c in chunks:
        storage.chunks.insert(c.model_dump())
    if chunks:
        upsert_chunks(chunks)

    return doc


def ingest_file(
    file_path: str,
    title: str,
    source_type: str,
    framework: CompetencyFramework,
    forced_domain_id: str | None = None,
) -> IngestedDocument:
    """source_type: 'pdf' or 'pptx'."""
    units = parse_document(file_path, source_type)
    return _ingest_units(
        title, SourceType(source_type), units, framework, forced_domain_id
    )


def ingest_transcript(
    transcript_text: str,
    title: str,
    framework: CompetencyFramework,
    forced_domain_id: str | None = None,
) -> IngestedDocument:
    units = parse_video_transcript(transcript_text)
    return _ingest_units(
        title, SourceType.VIDEO_TRANSCRIPT, units, framework, forced_domain_id
    )
