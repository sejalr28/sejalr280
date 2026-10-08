"""
schemas.py
----------
Pydantic models define the "shape" of data flowing in and out of our API.

Why this matters for an AI/ML backend:
FastAPI uses these models to automatically:
  1. Validate incoming request data (e.g. reject a request with no URL)
  2. Serialize outgoing responses into consistent JSON
  3. Generate interactive API docs at /docs

Keeping all schemas in one file makes it easy to see the full "API contract"
at a glance.
"""

from pydantic import BaseModel, Field
from typing import List, Literal


# ---------- Requests ----------

class VideoRequest(BaseModel):
    """Sent when the user submits a YouTube URL to be processed."""
    youtube_url: str = Field(..., description="Full YouTube video URL")


class ChatMessage(BaseModel):
    """One earlier message in the conversation."""
    role: Literal["user", "assistant"]
    text: str


class ChatRequest(BaseModel):
    """Sent when the user asks a question about a previously processed video."""
    video_id: str = Field(..., description="YouTube video ID (used as FAISS index filename)")
    question: str = Field(..., description="User's natural language question")
    history: List[ChatMessage] = Field(
        default_factory=list,
        description="Recent chat messages (oldest first), used to resolve follow-up questions",
    )


class SummaryRequest(BaseModel):
    """Sent to request a summary for a previously processed video."""
    video_id: str = Field(..., description="YouTube video ID")


# ---------- Responses ----------

class VideoProcessResponse(BaseModel):
    """Returned after a video has been fully processed (transcript -> embeddings -> stored)."""
    video_id: str
    title: str
    thumbnail_url: str
    num_chunks: int
    processing_time_seconds: float
    message: str


class VideoJobCreated(BaseModel):
    """Returned immediately when a video is submitted for background processing."""
    job_id: str
    status: str = "pending"


class VideoJobStatus(BaseModel):
    """
    Returned when polling a processing job.
    `stage` is a short machine-readable label for the frontend to map to a
    display string (e.g. "fetching_transcript" -> "Fetching transcript...").
    `result` is populated only once status == "done".
    """
    job_id: str
    status: str   # "pending" | "processing" | "done" | "error"
    stage: str
    result: VideoProcessResponse | None = None
    error: str | None = None


class Source(BaseModel):
    """A transcript chunk used to ground an answer, with where it starts in the video."""
    text: str
    start_time: float  # seconds from the start of the video


class ChatResponse(BaseModel):
    """Returned after answering a user's question via RAG."""
    answer: str
    sources: List[Source]  # empty when the video doesn't cover the question


class Chapter(BaseModel):
    """One timestamped section of a long video."""
    start_time: float  # seconds from the start of the video
    title: str
    summary: str


class SummaryResponse(BaseModel):
    """Returned after summarizing a video."""
    video_id: str
    summary: str
    chapters: List[Chapter] = Field(default_factory=list)  # empty for short videos


class QuizRequest(BaseModel):
    """Sent to generate a multiple-choice quiz for a processed video."""
    video_id: str = Field(..., description="YouTube video ID")
    count: int = Field(5, ge=1, le=10, description="Number of questions")


class QuizQuestion(BaseModel):
    question: str
    options: List[str]   # exactly 4
    answer_index: int    # index into options
    explanation: str
    start_time: float    # where in the video this is covered (seconds)


class QuizResponse(BaseModel):
    video_id: str
    questions: List[QuizQuestion]


class FlashcardRequest(BaseModel):
    """Sent to generate study flashcards for a processed video."""
    video_id: str = Field(..., description="YouTube video ID")
    count: int = Field(8, ge=1, le=15, description="Number of flashcards")


class Flashcard(BaseModel):
    front: str
    back: str
    start_time: float    # where in the video this is covered (seconds)


class FlashcardResponse(BaseModel):
    video_id: str
    cards: List[Flashcard]