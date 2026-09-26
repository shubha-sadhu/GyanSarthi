"""
Competency Engine.

Turns quiz attempt history into a live, continuously re-scored competency
profile per user, compares it against role targets, and produces a
prioritized learning roadmap. This is what makes the platform "dynamic"
rather than a one-time snapshot: call `compute_profile` again after any
new quiz attempt and every score re-derives from the full history.

Scoring model
-------------
Each quiz attempt yields an "evidence score" (0-100) that blends
correctness with the difficulty of material the learner handled:

    evidence = score_fraction * (difficulty_level * 20)

A perfect score on level-5 material yields the max evidence (100); a
perfect score on level-1 material caps out at 20, reflecting that easy
material proves less. Domain scores are then updated as an exponential
moving average (EMA) over attempts in chronological order, so recent
performance matters more than old attempts without discarding history
entirely — this is what lets the profile "re-score in real time."
"""
from __future__ import annotations

from datetime import datetime

from app.competency.framework import CompetencyFramework
from app.models import CompetencyProfile, DomainScore, RecommendedMaterial, Roadmap, RoadmapItem
from app.rag.vector_store import query as vector_query
from app.storage import get_storage

BASELINE_SCORE = 0.0  # a brand-new user with zero attempts starts at zero, not a phantom head start
EMA_ALPHA = 0.4  # how strongly the most recent attempt moves the score
MAX_SCORE = 100.0


def _evidence_score(score_fraction: float, difficulty_level: int) -> float:
    return max(0.0, min(1.0, score_fraction)) * (difficulty_level * 20)


def _domain_score_from_attempts(attempts: list[dict]) -> tuple[float, float, datetime | None]:
    """
    Returns (current_score, trend_per_attempt, last_updated) from a
    chronologically-ordered list of attempt records for one domain.
    """
    if not attempts:
        return BASELINE_SCORE, 0.0, None

    attempts = sorted(attempts, key=lambda a: a["submitted_at"])
    score = BASELINE_SCORE
    deltas: list[float] = []

    for a in attempts:
        evidence = _evidence_score(a["score_fraction"], a.get("difficulty", 3))
        new_score = score + EMA_ALPHA * (evidence - score)
        deltas.append(new_score - score)
        score = new_score

    score = max(0.0, min(MAX_SCORE, score))
    trend = sum(deltas[-3:]) / len(deltas[-3:]) if deltas else 0.0
    last_updated = datetime.fromisoformat(str(attempts[-1]["submitted_at"]))
    return score, trend, last_updated


def compute_profile(user_id: str, framework: CompetencyFramework) -> CompetencyProfile:
    storage = get_storage()
    user = storage.users.find_one(user_id=user_id)
    if not user:
        raise ValueError(f"Unknown user_id: {user_id}")

    role_id = user["role_id"]
    all_attempts = storage.attempts.find(user_id=user_id)
    quizzes_by_id = {q["quiz_id"]: q for q in storage.quizzes.all()}

    # Attach the difficulty of the quiz each attempt belongs to.
    enriched: dict[str, list[dict]] = {}
    for a in all_attempts:
        domain_id = a["domain_id"]
        quiz = quizzes_by_id.get(a["quiz_id"], {})
        # Use the average difficulty of questions in that quiz, default 3.
        questions = quiz.get("questions", [])
        difficulty = (
            round(sum(q["difficulty"] for q in questions) / len(questions))
            if questions
            else 3
        )
        record = dict(a)
        record["difficulty"] = difficulty
        enriched.setdefault(domain_id, []).append(record)

    domain_scores: list[DomainScore] = []
    relevant_domains = framework.domains_for_role(role_id) or framework.all_domains()

    for domain in relevant_domains:
        attempts = enriched.get(domain.domain_id, [])
        score, trend, last_updated = _domain_score_from_attempts(attempts)
        target_level = framework.target_level(role_id, domain.domain_id)
        current_level = max(1, min(5, round(score / 20) or 1))
        gap = max(0.0, target_level * 20 - score)

        domain_scores.append(
            DomainScore(
                domain_id=domain.domain_id,
                domain_name=domain.name,
                current_score=round(score, 1),
                current_level=current_level,
                target_level=target_level,
                gap=round(gap, 1),
                trend_per_attempt=round(trend, 2),
                last_updated=last_updated or datetime.utcnow(),
            )
        )

    overall = (
        sum(d.current_score for d in domain_scores) / len(domain_scores)
        if domain_scores
        else 0.0
    )

    return CompetencyProfile(
        user_id=user_id,
        role_id=role_id,
        domain_scores=domain_scores,
        overall_readiness=round(overall, 1),
    )


def generate_roadmap(
    user_id: str,
    framework: CompetencyFramework,
    max_items: int = 5,
    chunks_per_item: int = 3,
) -> Roadmap:
    """
    Ranks domains by (gap size, weighted by target importance), and for the
    top gaps retrieves the most relevant indexed content — this is where the
    competency engine calls back into the RAG vector store, so recommended
    material is always grounded in what's actually been ingested.
    """
    profile = compute_profile(user_id, framework)

    ranked = sorted(profile.domain_scores, key=lambda d: d.gap, reverse=True)
    ranked = [d for d in ranked if d.gap > 0][:max_items]

    items: list[RoadmapItem] = []
    for rank, d in enumerate(ranked, start=1):
        try:
            hits = vector_query(d.domain_name, top_k=chunks_per_item, domain_id=d.domain_id)
            materials = [
                RecommendedMaterial(
                    chunk_id=h.chunk_id,
                    title=h.title,
                    snippet=(h.text[:240].rsplit(" ", 1)[0] + "…") if len(h.text) > 240 else h.text,
                )
                for h in hits
            ]
        except Exception:
            materials = []  # vector store not configured / no content yet

        rationale = (
            f"Currently at level {d.current_level} (score {d.current_score}), "
            f"role target is level {d.target_level}. "
            + (
                "Recent attempts trending up — keep the momentum."
                if d.trend_per_attempt > 0
                else "No recent progress detected — prioritize this next."
            )
        )
        items.append(
            RoadmapItem(
                domain_id=d.domain_id,
                domain_name=d.domain_name,
                gap=d.gap,
                priority_rank=rank,
                recommended_materials=materials,
                rationale=rationale,
            )
        )

    return Roadmap(user_id=user_id, items=items)


def record_quiz_attempt(
    user_id: str,
    quiz_id: str,
    domain_id: str,
    num_correct: int,
    num_questions: int,
) -> dict:
    storage = get_storage()
    score_fraction = num_correct / num_questions if num_questions else 0.0
    attempt = {
        "attempt_id": f"attempt_{datetime.utcnow().timestamp()}",
        "quiz_id": quiz_id,
        "user_id": user_id,
        "domain_id": domain_id,
        "score_fraction": score_fraction,
        "num_correct": num_correct,
        "num_questions": num_questions,
        "submitted_at": datetime.utcnow().isoformat(),
    }
    storage.attempts.insert(attempt)
    return attempt
