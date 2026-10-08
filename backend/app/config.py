"""
config.py
----------
Centralized application configuration.

Why this file exists:
Instead of scattering `os.getenv(...)` calls across the codebase, we load
all environment variables ONCE here using pydantic-settings. This gives us:
  - Type validation (e.g. CHUNK_SIZE is guaranteed to be an int)
  - A single source of truth for tunable parameters
  - Easy access anywhere via `from app.config import settings`

This is a common real-world pattern in production FastAPI apps.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- LLM Provider (Groq) ---
    GROQ_API_KEY: str
    LLM_MODEL: str = "openai/gpt-oss-20b"

    # --- Embedding Model ---
    # This runs locally on CPU via sentence-transformers -> no external API cost.
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"

    # --- Chunking parameters ---
    # CHUNK_SIZE: max characters per chunk of transcript text.
    # CHUNK_OVERLAP: characters shared between consecutive chunks so we don't
    # lose context at chunk boundaries (a core RAG concept).
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    # --- RAG retrieval parameters ---
    # Number of most-similar chunks to retrieve from FAISS per question.
    TOP_K_RESULTS: int = 4

    # Minimum cosine similarity the BEST retrieved chunk must reach.
    # Below this, the video is treated as not covering the question.
    # Starting value -- tune it with the Phase 2 eval set.
    MIN_SIMILARITY: float = 0.2

    # --- Retrieval upgrades ---
    # Switch these on/off to compare them with the eval harness (python -m eval.run_eval).
    USE_HYBRID: bool = False     # add BM25 keyword search, fused with dense search (RRF)
    USE_RERANKER: bool = False   # rerank candidates with a cross-encoder
    CANDIDATE_POOL: int = 20     # candidates gathered from each search before fusing/reranking
    RERANKER_MODEL: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    # How many recent chat messages are used to resolve follow-up questions.
    HISTORY_MESSAGES: int = 6

    # --- FAISS index storage location ---
    # Each processed video gets its own index file + metadata file saved here.
    FAISS_INDEX_DIR: str = "./faiss_indexes"

    # --- Caching ---
    # Raw transcripts rarely change, so we cache them on disk to avoid
    # re-hitting YouTube (which rate-limits/blocks aggressively, especially
    # from cloud IPs) every time a video is re-processed or re-summarized.
    TRANSCRIPT_CACHE_DIR: str = "./transcript_cache"
    # Max FAISS indexes kept in memory at once (least-recently-used evicted).
    # Avoids re-reading the index file from disk on every single question.
    INDEX_CACHE_SIZE: int = 32

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Single shared instance imported across the app.
# e.g. from app.config import settings -> settings.GROQ_API_KEY
settings = Settings()