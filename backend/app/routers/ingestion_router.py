from __future__ import annotations

import os
import shutil
import tempfile

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.competency.framework import load_framework
from app.ingestion.pipeline import ingest_book_split_by_chapters, ingest_file, ingest_transcript
from app.storage import get_storage

router = APIRouter(prefix="/ingest", tags=["ingestion"])
_framework = load_framework()


def _resolve_domain_for_chapter(chapter_id: str | None, domain_id: str | None) -> str | None:
    """If a chapter is given, its own domain always wins — guarantees a
    chapter's content can never end up split across two domains."""
    if not chapter_id:
        return domain_id
    chapter = get_storage().chapters.find_one(chapter_id=chapter_id)
    if not chapter:
        raise HTTPException(400, f"Chapter '{chapter_id}' not found.")
    return chapter["domain_id"]


@router.post("/document")
async def ingest_document(
    file: UploadFile = File(...),
    source_type: str = Form(...),  # "pdf" | "pptx"
    domain_id: str | None = Form(default=None),
    chapter_id: str | None = Form(default=None),
):
    """
    Upload a single PDF or PPTX; it is parsed, chunked, domain-tagged, and
    embedded. Pass chapter_id to add this file to an existing chapter
    (e.g. a supplementary PDF for a chapter you already have) — its domain
    is then taken from that chapter automatically.
    """
    resolved_domain_id = _resolve_domain_for_chapter(chapter_id, domain_id)

    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        doc = ingest_file(
            tmp_path,
            title=file.filename,
            source_type=source_type,
            framework=_framework,
            forced_domain_id=resolved_domain_id,
            chapter_id=chapter_id,
        )
    finally:
        os.unlink(tmp_path)

    return doc.model_dump()


@router.post("/book")
async def ingest_book(
    file: UploadFile = File(...),
    source_type: str = Form(...),  # "pdf" | "pptx"
    domain_id: str = Form(...),
    title: str | None = Form(default=None),
):
    """
    Upload a whole book/textbook. It's automatically split into chapters
    by detecting headings like "Chapter 3" near the top of pages, and each
    detected chapter is ingested and embedded as its own chapter, ready
    for chapter-wise testing. domain_id is required — a whole book is
    assumed to belong to one subject.
    """
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        docs = ingest_book_split_by_chapters(
            tmp_path,
            book_title=title or file.filename,
            source_type=source_type,
            framework=_framework,
            domain_id=domain_id,
        )
    finally:
        os.unlink(tmp_path)

    return [d.model_dump() for d in docs]


@router.post("/transcript")
async def ingest_video_transcript(
    title: str = Form(...),
    transcript_text: str = Form(...),
    domain_id: str | None = Form(default=None),
    chapter_id: str | None = Form(default=None),
):
    """
    Ingest a video's transcript text (e.g. from an ASR step upstream).
    Treated identically to PDF/PPTX content once it's text.
    """
    resolved_domain_id = _resolve_domain_for_chapter(chapter_id, domain_id)
    doc = ingest_transcript(
        transcript_text,
        title=title,
        framework=_framework,
        forced_domain_id=resolved_domain_id,
        chapter_id=chapter_id,
    )
    return doc.model_dump()
