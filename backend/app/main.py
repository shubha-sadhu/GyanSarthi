"""
Gyan Sarthi backend — RAG + Vector Embeddings + Competency Engine.

Run with:
    uvicorn app.main:app --reload

Then open http://127.0.0.1:8000/docs for interactive Swagger UI.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import competency_router, ingestion_router, quiz_router, users_router

app = FastAPI(
    title="Gyan Sarthi API",
    description=(
        "AI-Enabled Dynamic Competency-Based Learning Platform — "
        "RAG content ingestion, vector search, and the competency engine."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users_router.router)
app.include_router(ingestion_router.router)
app.include_router(quiz_router.router)
app.include_router(competency_router.router)


@app.get("/")
def root():
    return {
        "service": "gyan-sarthi-backend",
        "modules": ["rag", "vector_store (pinecone)", "competency_engine"],
        "docs": "/docs",
    }
