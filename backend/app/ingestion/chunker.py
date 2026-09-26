"""
Splits parsed pages/slides into overlapping chunks sized for retrieval.

Uses a simple word-count proxy for tokens (good enough for chunking;
we don't need exact tokenizer parity here). Overlap keeps context that
straddles a chunk boundary from being lost.
"""
from __future__ import annotations

from app.ingestion.document_parser import ParsedUnit


def _split_words(text: str) -> list[str]:
    return text.split()


def chunk_units(
    units: list[ParsedUnit],
    chunk_size_tokens: int = 350,
    overlap_tokens: int = 60,
) -> list[tuple[str, int]]:
    """
    Concatenates unit text with page/slide markers preserved, then produces
    overlapping chunks. Returns (chunk_text, source_index) pairs, where
    source_index is the page/slide number the chunk *starts* in.
    """
    chunks: list[tuple[str, int]] = []

    for unit in units:
        words = _split_words(unit.text)
        if not words:
            continue

        if len(words) <= chunk_size_tokens:
            chunks.append((unit.text, unit.index))
            continue

        start = 0
        while start < len(words):
            end = min(start + chunk_size_tokens, len(words))
            piece = " ".join(words[start:end])
            chunks.append((piece, unit.index))
            if end == len(words):
                break
            start = end - overlap_tokens  # step back for overlap

    return chunks
