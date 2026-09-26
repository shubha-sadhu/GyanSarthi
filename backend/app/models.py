"""
Shared data models for the three modules: RAG, vector store, competency engine.

Kept framework-agnostic (plain Pydantic) so they can be persisted to
JSON files (current demo storage) or to MongoDB Atlas later without
changing the module logic.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# --------------------------------------------------------------------------
# Content / ingestion
# --------------------------------------------------------------------------

class SourceType(str, Enum):
    PDF = "pdf"
    PPTX = "pptx"
    VIDEO_TRANSCRIPT = "video_transcript"
    TEXT = "text"


class DocumentChunk(BaseModel):
    """A single retrievable unit of content, stored in the vector index."""
    chunk_id: str = Field(default_factory=lambda: new_id("chunk"))
    document_id: str
    source_type: SourceType
    domain_id: str  # competency domain this chunk primarily supports
    title: str
    text: str
    page_or_slide: Optional[int] = None
    order: int = 0


class IngestedDocument(BaseModel):
    document_id: str = Field(default_factory=lambda: new_id("doc"))
    title: str
    source_type: SourceType
    domain_id: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    num_chunks: int = 0


# --------------------------------------------------------------------------
# Competency framework
# --------------------------------------------------------------------------

class ProficiencyLevel(int, Enum):
    NOVICE = 1
    BEGINNER = 2
    COMPETENT = 3
    PROFICIENT = 4
    EXPERT = 5


class CompetencyDomain(BaseModel):
    """One skill area in the Statistics-specific competency framework."""
    domain_id: str
    name: str
    description: str
    category: str  # e.g. "Functional", "Domain", "Behavioural"


class RoleRequirement(BaseModel):
    """Target proficiency a given role/designation is expected to reach in a domain."""
    role_id: str
    domain_id: str
    target_level: ProficiencyLevel


class Role(BaseModel):
    role_id: str
    title: str  # e.g. "Statistical Officer", "Data Analyst - NSSO"
    description: str = ""


# --------------------------------------------------------------------------
# Users / attempts / quizzes
# --------------------------------------------------------------------------

class User(BaseModel):
    user_id: str = Field(default_factory=lambda: new_id("user"))
    name: str
    role_id: str
    joined_at: datetime = Field(default_factory=datetime.utcnow)


class QuestionOption(BaseModel):
    option_id: str
    text: str


class Question(BaseModel):
    question_id: str = Field(default_factory=lambda: new_id("q"))
    domain_id: str
    difficulty: ProficiencyLevel
    prompt: str
    options: list[QuestionOption]
    correct_option_id: str
    explanation: str
    source_chunk_ids: list[str] = Field(default_factory=list)


class Quiz(BaseModel):
    quiz_id: str = Field(default_factory=lambda: new_id("quiz"))
    domain_id: str
    document_id: Optional[str] = None
    questions: list[Question]
    generated_at: datetime = Field(default_factory=datetime.utcnow)


class QuizAttemptAnswer(BaseModel):
    question_id: str
    selected_option_id: str


class QuizAttemptResult(BaseModel):
    attempt_id: str = Field(default_factory=lambda: new_id("attempt"))
    quiz_id: str
    user_id: str
    domain_id: str
    score_fraction: float  # 0..1
    num_correct: int
    num_questions: int
    submitted_at: datetime = Field(default_factory=datetime.utcnow)


# --------------------------------------------------------------------------
# Competency scoring output
# --------------------------------------------------------------------------

class DomainScore(BaseModel):
    domain_id: str
    domain_name: str
    current_score: float  # 0..100, continuous competency score
    current_level: int  # 1..5 discretized level
    target_level: int
    gap: float  # target_level*20 - current_score, floor 0
    trend_per_attempt: float  # recent average delta per attempt (predictive signal)
    last_updated: datetime


class CompetencyProfile(BaseModel):
    user_id: str
    role_id: str
    domain_scores: list[DomainScore]
    overall_readiness: float  # 0..100 aggregate


class RecommendedMaterial(BaseModel):
    """An actual piece of ingested content pointing at what to study."""
    chunk_id: str
    title: str
    snippet: str


class RoadmapItem(BaseModel):
    domain_id: str
    domain_name: str
    gap: float
    priority_rank: int
    recommended_materials: list[RecommendedMaterial] = Field(default_factory=list)
    rationale: str


class Roadmap(BaseModel):
    user_id: str
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    items: list[RoadmapItem]
