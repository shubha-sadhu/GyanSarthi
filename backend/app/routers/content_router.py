from __future__ import annotations

from fastapi import APIRouter

from app.storage import get_storage

router = APIRouter(prefix="/content", tags=["content"])


@router.get("/documents")
def list_documents(domain_id: str | None = None):
    """
    Lists ingested documents, optionally filtered to one domain. This is
    what lets the frontend show "chapters" under each domain for
    chapter-wise testing, alongside the existing whole-domain assessment.
    """
    storage = get_storage()
    docs = storage.documents.find(domain_id=domain_id) if domain_id else storage.documents.all()
    return sorted(docs, key=lambda d: d.get("uploaded_at", ""), reverse=True)


@router.get("/chapters")
def list_chapters(domain_id: str | None = None):
    """
    Lists chapters, optionally filtered to one domain, each annotated with
    how many documents/chunks have been added to it so far. A chapter can
    have multiple documents (e.g. several PDFs uploaded over time) — this
    is what the admin's upload form uses to offer "add to an existing
    chapter" instead of always creating a new one, and what the quiz page
    uses to offer chapter-wise testing.
    """
    storage = get_storage()
    chapters = storage.chapters.find(domain_id=domain_id) if domain_id else storage.chapters.all()
    docs = storage.documents.all()

    for chapter in chapters:
        related = [d for d in docs if d.get("chapter_id") == chapter["chapter_id"]]
        chapter["num_documents"] = len(related)
        chapter["num_chunks"] = sum(d.get("num_chunks", 0) for d in related)

    return sorted(chapters, key=lambda c: c.get("created_at", ""), reverse=True)
