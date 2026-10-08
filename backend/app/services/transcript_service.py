import json
import os
import xml.etree.ElementTree as ET

from fastapi import HTTPException
from youtube_transcript_api import YouTubeTranscriptApi

from app.config import settings

try:
    from youtube_transcript_api import TranscriptsDisabled, NoTranscriptFound, VideoUnavailable
except ImportError:
    from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound, VideoUnavailable

_PREFERRED_LANGS = ["en", "en-US", "en-GB"]

os.makedirs(settings.TRANSCRIPT_CACHE_DIR, exist_ok=True)


def _cache_path(video_id: str) -> str:
    return os.path.join(settings.TRANSCRIPT_CACHE_DIR, f"{video_id}.json")


def _read_cache(video_id: str) -> list[dict] | None:
    path = _cache_path(video_id)
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None  # corrupt cache entry -- re-fetch instead of crashing


def _write_cache(video_id: str, segments: list[dict]) -> None:
    try:
        with open(_cache_path(video_id), "w", encoding="utf-8") as f:
            json.dump(segments, f)
    except OSError:
        pass  # caching is an optimization, not a requirement -- never fail the request over it


def _fetch_raw_segments(video_id: str) -> list[dict]:
    """
    Fetches raw transcript segments, supporting both the current
    instance-based API (YouTubeTranscriptApi().fetch(...)) and the
    legacy classmethod API (YouTubeTranscriptApi.get_transcript(...)),
    since the library's API surface changed between major versions.
    """
    try:
        api = YouTubeTranscriptApi()
        fetched = api.fetch(video_id, languages=_PREFERRED_LANGS)

        if hasattr(fetched, "to_raw_data"):
            return fetched.to_raw_data()

        return [
            {"text": snippet.text, "start": snippet.start, "duration": snippet.duration}
            for snippet in fetched
        ]
    except AttributeError:
        return YouTubeTranscriptApi.get_transcript(video_id, languages=_PREFERRED_LANGS)


def fetch_transcript(video_id: str) -> list[dict]:
    """
    Fetches the transcript for a given YouTube video ID, using a disk cache.

    Returns a list of segments, each shaped like:
        {"text": "some spoken words", "start": 12.4, "duration": 3.2}

    Transcripts are cached on disk (keyed by video_id) because:
      1. Videos re-processed, re-summarized, or re-queried via the eval
         harness would otherwise re-fetch the same transcript repeatedly.
      2. youtube-transcript-api is fetched from a cloud IP in production,
         and YouTube rate-limits/blocks that more aggressively than a
         residential IP -- caching sharply reduces how often we ask.
    """
    cached = _read_cache(video_id)
    if cached is not None:
        return cached

    try:
        transcript_segments = _fetch_raw_segments(video_id)
    except TranscriptsDisabled:
        raise HTTPException(
            status_code=422,
            detail="Transcripts are disabled for this video."
        )
    except NoTranscriptFound:
        raise HTTPException(
            status_code=422,
            detail="No English transcript is available for this video."
        )
    except VideoUnavailable:
        raise HTTPException(
            status_code=404,
            detail="This video is unavailable."
        )
    except ET.ParseError as e:
        raise HTTPException(
            status_code=502,
            detail=f"YouTube returned invalid transcript data: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch transcript: {str(e)}"
        )

    if not transcript_segments:
        raise HTTPException(
            status_code=422,
            detail="Transcript was empty for this video."
        )

    _write_cache(video_id, transcript_segments)
    return transcript_segments


def transcript_to_plain_text(transcript_segments: list[dict]) -> str:
    """
    Joins all transcript segments into a single continuous string.
    Useful for full-video operations like summarization, where we don't
    need per-segment timestamps -- just the complete text.
    """
    return " ".join(segment["text"] for segment in transcript_segments)