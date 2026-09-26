"""
Retrieval-Augmented Generation engine.

Two capabilities, both grounded strictly in retrieved chunks so the model
can't hallucinate questions/answers unrelated to the uploaded material:

1. generate_quiz(...)  — retrieve chunks for a domain/document, ask Claude
   for structured MCQs with distractors + explanations, grounded only in
   the retrieved text.
2. answer_question(...) — classic RAG Q&A with source attribution.
"""
from __future__ import annotations

from app.config import get_settings
from app.llm_client import complete_json
from app.models import ProficiencyLevel, Question, QuestionOption, Quiz
from app.rag.vector_store import RetrievedChunk, query as vector_query

_QUIZ_SYSTEM = (
    "You are an expert assessment designer for a government statistics "
    "training platform (MoSPI/NSSO officials). You write multiple-choice "
    "questions STRICTLY grounded in the provided source material — never "
    "invent facts not present in the sources. Each question must have "
    "exactly 4 options, one correct answer, and plausible distractors "
    "(not obviously wrong). Match the requested difficulty: level 1-2 = "
    "recall/definitions, level 3 = applied understanding, level 4-5 = "
    "analysis/edge cases."
)


def _format_sources(chunks: list[RetrievedChunk]) -> str:
    return "\n\n".join(
        f"[SOURCE {i+1} | chunk_id={c.chunk_id}]\n{c.text}"
        for i, c in enumerate(chunks)
    )


def generate_quiz(
    domain_id: str,
    difficulty: ProficiencyLevel,
    num_questions: int = 5,
    document_id: str | None = None,
    topic_hint: str | None = None,
) -> Quiz:
    settings = get_settings()
    search_text = topic_hint or domain_id.replace("_", " ")
    chunks = vector_query(search_text, top_k=max(num_questions, settings.default_top_k), domain_id=domain_id)

    if not chunks:
        raise ValueError(
            f"No indexed content found for domain '{domain_id}'. Ingest material first."
        )

    if document_id:
        chunks = [c for c in chunks if c.document_id == document_id] or chunks

    sources_block = _format_sources(chunks)
    user_prompt = f"""
Source material:
{sources_block}

Generate exactly {num_questions} multiple-choice questions at difficulty
level {int(difficulty)}/5, testing understanding of the source material above.

Respond as JSON:
{{
  "questions": [
    {{
      "prompt": "...",
      "options": [{{"id": "a", "text": "..."}}, {{"id": "b", "text": "..."}}, {{"id": "c", "text": "..."}}, {{"id": "d", "text": "..."}}],
      "correct_option_id": "a",
      "explanation": "why this is correct, referencing the source content",
      "source_indices": [1, 2]
    }}
  ]
}}
""".strip()

    result = complete_json(_QUIZ_SYSTEM, user_prompt, max_tokens=3000)

    questions: list[Question] = []
    for q in result.get("questions", []):
        # Gemini's JSON output sometimes returns these as strings ("1")
        # rather than numbers (1) — coerce defensively rather than assuming
        # the model always types them correctly.
        raw_indices = q.get("source_indices", [])
        parsed_indices: list[int] = []
        for raw in raw_indices:
            try:
                idx = int(raw)
            except (TypeError, ValueError):
                continue
            if 1 <= idx <= len(chunks):
                parsed_indices.append(idx)
        source_chunk_ids = [chunks[idx - 1].chunk_id for idx in parsed_indices]
        questions.append(
            Question(
                domain_id=domain_id,
                difficulty=difficulty,
                prompt=q["prompt"],
                options=[QuestionOption(option_id=o["id"], text=o["text"]) for o in q["options"]],
                correct_option_id=q["correct_option_id"],
                explanation=q.get("explanation", ""),
                source_chunk_ids=source_chunk_ids or [chunks[0].chunk_id],
            )
        )

    return Quiz(domain_id=domain_id, document_id=document_id, questions=questions)


_QA_SYSTEM = (
    "You answer questions for government statistics officials using ONLY "
    "the provided source excerpts. If the sources don't contain the answer, "
    "say so plainly rather than guessing. Cite which source number(s) you "
    "used at the end of relevant sentences, like [SOURCE 2]."
)


def answer_question(question_text: str, domain_id: str | None = None, top_k: int = 5) -> dict:
    chunks = vector_query(question_text, top_k=top_k, domain_id=domain_id)
    if not chunks:
        return {
            "answer": "No indexed content is available yet to answer this question.",
            "sources": [],
        }

    sources_block = _format_sources(chunks)
    user_prompt = f"Source material:\n{sources_block}\n\nQuestion: {question_text}\n\nAnswer:"
    from app.llm_client import complete

    answer = complete(_QA_SYSTEM, user_prompt, max_tokens=800, temperature=0.2)
    return {
        "answer": answer,
        "sources": [
            {"chunk_id": c.chunk_id, "title": c.title, "document_id": c.document_id}
            for c in chunks
        ],
    }
