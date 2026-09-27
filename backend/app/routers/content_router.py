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
