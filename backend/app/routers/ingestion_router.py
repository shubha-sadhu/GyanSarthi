from __future__ import annotations

import os
import shutil
import tempfile

from fastapi import APIRouter, File, Form, UploadFile

from app.competency.framework import load_framework
from app.ingestion.pipeline import ingest_file, ingest_transcript

router = APIRouter(prefix="/ingest", tags=["ingestion"])
_framework = load_framework()


@router.post("/document")
async def ingest_document(
    file: UploadFile = File(...),
    source_type: str = Form(...),  # "pdf" | "pptx"
    domain_id: str | None = Form(default=None),
):
    """Upload a PDF or PPTX; it is parsed, chunked, domain-tagged, and embedded."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        doc = ingest_file(
            tmp_path,
            title=file.filename,
            source_type=source_type,
            framework=_framework,
            forced_domain_id=domain_id,
        )
    finally:
        os.unlink(tmp_path)

    return doc.model_dump()


@router.post("/transcript")
async def ingest_video_transcript(
    title: str = Form(...),
    transcript_text: str = Form(...),
    domain_id: str | None = Form(default=None),
):
    """
    Ingest a video's transcript text (e.g. from an ASR step upstream).
    Treated identically to PDF/PPTX content once it's text.
    """
    doc = ingest_transcript(
        transcript_text, title=title, framework=_framework, forced_domain_id=domain_id
    )
    return doc.model_dump()
