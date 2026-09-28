"""
Ties together parsing, chunking, domain tagging, and vector-store upsert
into a single call: ingest_file(...) / ingest_transcript(...), plus
ingest_book_split_by_chapters(...) for a whole book at once.
"""
from __future__ import annotations

from app.competency.framework import CompetencyFramework
from app.config import get_settings
from app.ingestion.chapter_splitter import split_into_chapters
from app.ingestion.chunker import chunk_units
from app.ingestion.document_parser import parse_document, parse_video_transcript
from app.ingestion.domain_tagger import tag_domain
from app.models import Chapter, DocumentChunk, IngestedDocument, SourceType
from app.rag.vector_store import upsert_chunks
from app.storage import get_storage


def _ingest_units(
    title: str,
    source_type: SourceType,
    units,
    framework: CompetencyFramework,
    forced_domain_id: str | None,
    chapter_id: str | None,
) -> IngestedDocument:
    settings = get_settings()
    storage = get_storage()

    doc = IngestedDocument(
        title=title,
        source_type=source_type,
        domain_id=forced_domain_id or "",
        chapter_id=chapter_id,
    )
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
            chapter_id=chapter_id,
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

    # Persist metadata first so the document/chapter is visible right away,
    # then attempt the actual embedding. Only a successful upsert marks it
    # "complete" — if Pinecone fails here (bad key, network issue, index
    # not ready), the document stays visible but clearly flagged as not
    # actually searchable yet, instead of silently looking identical to a
    # real success.
    storage.documents.insert(doc.model_dump())
    for c in chunks:
        storage.chunks.insert(c.model_dump())

    if not chunks:
        doc.embedding_status = "complete"  # nothing to embed, trivially done
    else:
        try:
            upsert_chunks(chunks)
            doc.embedding_status = "complete"
        except Exception as exc:
            doc.embedding_status = "failed"
            doc.embedding_error = str(exc)

    storage.documents.upsert("document_id", doc.model_dump())

    return doc


def ingest_file(
    file_path: str,
    title: str,
    source_type: str,
    framework: CompetencyFramework,
    forced_domain_id: str | None = None,
    chapter_id: str | None = None,
) -> IngestedDocument:
    """source_type: 'pdf' or 'pptx'."""
    units = parse_document(file_path, source_type)
    return _ingest_units(
        title, SourceType(source_type), units, framework, forced_domain_id, chapter_id
    )


def ingest_transcript(
    transcript_text: str,
    title: str,
    framework: CompetencyFramework,
    forced_domain_id: str | None = None,
    chapter_id: str | None = None,
) -> IngestedDocument:
    units = parse_video_transcript(transcript_text)
    return _ingest_units(
        title, SourceType.VIDEO_TRANSCRIPT, units, framework, forced_domain_id, chapter_id
    )


def ingest_book_split_by_chapters(
    file_path: str,
    book_title: str,
    source_type: str,
    framework: CompetencyFramework,
    domain_id: str,
) -> list[IngestedDocument]:
    """
    Splits a whole book into chapters (by heading detection — see
    chapter_splitter.py), creates a Chapter record for each one detected,
    and ingests each chapter's pages as its own document tagged with that
    chapter_id. A single upload becomes several independently
    chapter-testable pieces of content.

    domain_id is required here (no auto-detect): a chapter must belong to
    one known domain, and asking the LLM to classify each chunk
    individually would be slow, costly, and could inconsistently split a
    single chapter across multiple domains.
    """
    storage = get_storage()
    units = parse_document(file_path, source_type)
    detected_chapters = split_into_chapters(units, fallback_title=book_title)

    results: list[IngestedDocument] = []
    for detected in detected_chapters:
        if detected.is_front_matter:
            # Title page / table of contents / preface — real content, but
            # not a testable "chapter". Ingested as plain domain content
            # (still searchable for full-domain quizzes) without cluttering
            # the chapter list with something meaningless to test on.
            doc = _ingest_units(
                title=f"{book_title} — front matter",
                source_type=SourceType(source_type),
                units=detected.units,
                framework=framework,
                forced_domain_id=domain_id,
                chapter_id=None,
            )
            results.append(doc)
            continue

        chapter = Chapter(domain_id=domain_id, title=detected.title)
        storage.chapters.insert(chapter.model_dump())

        doc = _ingest_units(
            title=f"{book_title} — {detected.title}",
            source_type=SourceType(source_type),
            units=detected.units,
            framework=framework,
            forced_domain_id=domain_id,
            chapter_id=chapter.chapter_id,
        )
        results.append(doc)

    return results
