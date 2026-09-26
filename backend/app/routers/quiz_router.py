from __future__ import annotations

from pydantic import BaseModel

from fastapi import APIRouter

from app.models import ProficiencyLevel, QuizAttemptAnswer
from app.rag.rag_engine import answer_question, generate_quiz
from app.storage import get_storage
from app.competency.engine import record_quiz_attempt

router = APIRouter(prefix="/quiz", tags=["quiz"])


class GenerateQuizRequest(BaseModel):
    domain_id: str
    difficulty: int = 3
    num_questions: int = 5
    document_id: str | None = None
    topic_hint: str | None = None


@router.post("/generate")
def generate(req: GenerateQuizRequest):
    quiz = generate_quiz(
        domain_id=req.domain_id,
        difficulty=ProficiencyLevel(req.difficulty),
        num_questions=req.num_questions,
        document_id=req.document_id,
        topic_hint=req.topic_hint,
    )
    get_storage().quizzes.insert(quiz.model_dump())
    return quiz.model_dump()


class SubmitQuizRequest(BaseModel):
    quiz_id: str
    user_id: str
    answers: list[QuizAttemptAnswer]


@router.post("/submit")
def submit(req: SubmitQuizRequest):
    storage = get_storage()
    quiz = storage.quizzes.find_one(quiz_id=req.quiz_id)
    if not quiz:
        return {"error": f"quiz {req.quiz_id} not found"}

    correct_map = {q["question_id"]: q["correct_option_id"] for q in quiz["questions"]}
    explanation_map = {q["question_id"]: q["explanation"] for q in quiz["questions"]}

    num_correct = 0
    feedback = []
    for ans in req.answers:
        is_correct = correct_map.get(ans.question_id) == ans.selected_option_id
        num_correct += int(is_correct)
        feedback.append(
            {
                "question_id": ans.question_id,
                "correct": is_correct,
                "correct_option_id": correct_map.get(ans.question_id),
                "explanation": explanation_map.get(ans.question_id),
            }
        )

    attempt = record_quiz_attempt(
        user_id=req.user_id,
        quiz_id=req.quiz_id,
        domain_id=quiz["domain_id"],
        num_correct=num_correct,
        num_questions=len(quiz["questions"]),
    )

    return {
        "attempt": attempt,
        "score_fraction": attempt["score_fraction"],
        "feedback": feedback,
    }


class AskRequest(BaseModel):
    question: str
    domain_id: str | None = None


@router.post("/ask")
def ask(req: AskRequest):
    """Direct RAG Q&A against ingested content, independent of quizzes."""
    return answer_question(req.question, domain_id=req.domain_id)
