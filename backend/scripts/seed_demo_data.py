"""
Seeds fake users and a fake quiz-attempt history so the competency engine
(profile scoring, gap analysis, roadmap ranking, heatmap) is fully
demoable WITHOUT needing Pinecone/Gemini keys configured.

The RAG side (ingesting real documents, generating real quizzes from them)
still needs real API keys — this script only fabricates the *attempt
history* that the scoring engine consumes, using the same storage layer
and schema the real API writes to.

Run with:
    python -m scripts.seed_demo_data
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta

from app.models import ProficiencyLevel, Question, QuestionOption, Quiz, User
from app.storage import get_storage

random.seed(42)

DEMO_USERS = [
    {"name": "Ananya Roy", "role_id": "field_investigator"},
    {"name": "Vikram Nair", "role_id": "statistical_officer"},
    {"name": "Sunita Deshmukh", "role_id": "deputy_director"},
    {"name": "Rahul Bose", "role_id": "statistical_officer"},
]

# domain_id -> list of (difficulty, [score_fractions over time]) simulating
# a learner who improves with practice, at varying paces per domain.
DOMAIN_LEARNING_CURVES = {
    "field_investigator": {
        "survey_methodology": [(1, 0.4), (2, 0.5), (2, 0.6), (3, 0.7)],
        "data_collection_tools": [(2, 0.5), (3, 0.6), (3, 0.75), (4, 0.8)],
        "data_governance": [(1, 0.3), (2, 0.4)],
        "digital_tools": [(1, 0.6), (2, 0.7)],
    },
    "statistical_officer": {
        "survey_methodology": [(2, 0.5), (3, 0.6), (3, 0.7), (4, 0.65)],
        "statistical_analysis": [(2, 0.45), (3, 0.55), (3, 0.6), (4, 0.7)],
        "data_visualization": [(2, 0.5), (3, 0.6)],
        "national_accounts": [(2, 0.4), (2, 0.5)],
        "data_governance": [(2, 0.5), (3, 0.55)],
        "digital_tools": [(2, 0.6), (3, 0.7)],
    },
    "deputy_director": {
        "statistical_analysis": [(3, 0.7), (4, 0.75), (4, 0.8)],
        "national_accounts": [(3, 0.6), (4, 0.65), (4, 0.75)],
        "data_governance": [(4, 0.8), (5, 0.85)],
        "leadership_coordination": [(3, 0.6), (4, 0.7)],
        "digital_tools": [(2, 0.5), (3, 0.55)],
    },
}


def _make_dummy_quiz(domain_id: str, difficulty: int, num_questions: int = 5) -> Quiz:
    questions = [
        Question(
            domain_id=domain_id,
            difficulty=ProficiencyLevel(difficulty),
            prompt=f"[seed] sample question {i+1} on {domain_id}",
            options=[
                QuestionOption(option_id="a", text="Option A"),
                QuestionOption(option_id="b", text="Option B"),
                QuestionOption(option_id="c", text="Option C"),
                QuestionOption(option_id="d", text="Option D"),
            ],
            correct_option_id="a",
            explanation="Seed data explanation.",
        )
        for i in range(num_questions)
    ]
    return Quiz(domain_id=domain_id, questions=questions)


def seed():
    storage = get_storage()

    print("Seeding users...")
    users = []
    for u in DEMO_USERS:
        user = User(**u)
        storage.users.insert(user.model_dump())
        users.append(user)
        print(f"  created {user.name} ({user.role_id}) -> {user.user_id}")

    print("Seeding quiz attempt history...")
    base_time = datetime.utcnow() - timedelta(days=30)

    for user in users:
        curves = DOMAIN_LEARNING_CURVES.get(user.role_id, {})
        for domain_id, attempts in curves.items():
            for i, (difficulty, score_fraction) in enumerate(attempts):
                quiz = _make_dummy_quiz(domain_id, difficulty)
                storage.quizzes.insert(quiz.model_dump())

                num_questions = len(quiz.questions)
                num_correct = round(score_fraction * num_questions)
                submitted_at = base_time + timedelta(days=i * 4, hours=random.randint(0, 12))

                attempt = {
                    "attempt_id": f"seed_attempt_{user.user_id}_{domain_id}_{i}",
                    "quiz_id": quiz.quiz_id,
                    "user_id": user.user_id,
                    "domain_id": domain_id,
                    "score_fraction": score_fraction,
                    "num_correct": num_correct,
                    "num_questions": num_questions,
                    "submitted_at": submitted_at.isoformat(),
                }
                storage.attempts.insert(attempt)

    print(f"\nDone. Seeded {len(users)} users with attempt history.")
    print("Try: GET /competency/profile/<user_id>, /competency/roadmap/<user_id>, /competency/heatmap")
    for user in users:
        print(f"  {user.name}: {user.user_id}")


if __name__ == "__main__":
    seed()
