"""
video_routes.py
-----------------
REST API endpoints for processing a YouTube video end-to-end:
  URL -> video ID -> transcript -> chunks -> embeddings -> FAISS storage

The pipeline runs as a BACKGROUND JOB rather than inside the request:
  POST /api/video/process       -> returns {job_id} immediately
  GET  /api/video/jobs/{job_id}  -> the frontend polls this for progress/result

Why a background job instead of one synchronous call:
Fetching a transcript and computing embeddings for a long video can take
anywhere from a few seconds to over a minute. Doing that inside a single
HTTP request works, but it means one slow video ties up a request the whole
time, the frontend can't show real progress (only a fake timer), and if the
connection drops the work is lost. A job the frontend can poll fixes all
three, and it is the same shape production systems use for slow pipelines.
"""

import time

from fastapi import APIRouter, BackgroundTasks, HTTPException

from app.models.schemas import (
    VideoJobCreated,
    VideoJobStatus,
    VideoProcessResponse,
    VideoRequest,
)
from app.services import job_service
from app.services.chunking_service import chunk_transcript
from app.services.transcript_service import fetch_transcript
from app.services.vectorstore_service import store_chunks
from app.utils.youtube_utils import extract_video_id, fetch_video_metadata

router = APIRouter(prefix="/api/video", tags=["Video Processing"])


def _run_pipeline(job_id: str, youtube_url: str) -> None:
    """
    The actual pipeline, run in a background thread (see process_video below).
    Every step updates the job's `stage` so the frontend can show real
    progress instead of a fake timer.
    """
    start_time = time.monotonic()
    try:
        job_service.set_stage(job_id, "fetching_transcript")
        video_id = extract_video_id(youtube_url)
        transcript_segments = fetch_transcript(video_id)  # raises HTTPException on failure

        job_service.set_stage(job_id, "chunking")
        chunks = chunk_transcript(transcript_segments)
        if not chunks:
            job_service.set_error(job_id, "Could not generate any chunks from this transcript.", 422)
            return

        job_service.set_stage(job_id, "embedding_and_indexing")
        store_chunks(video_id, chunks)

        # Best-effort metadata lookup (title + thumbnail) -- never blocks
        # or fails the job, since it's a nice-to-have for the UI.
        metadata = fetch_video_metadata(video_id)

        elapsed_seconds = round(time.monotonic() - start_time, 2)
        job_service.set_done(job_id, VideoProcessResponse(
            video_id=video_id,
            title=metadata["title"],
            thumbnail_url=metadata["thumbnail_url"],
            num_chunks=len(chunks),
            processing_time_seconds=elapsed_seconds,
            message="Indexed successfully. You can now ask questions or request a summary.",
        ).model_dump())

    except HTTPException as e:
        job_service.set_error(job_id, e.detail, e.status_code)
    except Exception as e:
        job_service.set_error(job_id, f"Unexpected error: {str(e)}", 500)


@router.post("/process", response_model=VideoJobCreated, status_code=202)
def process_video(request: VideoRequest, background_tasks: BackgroundTasks):
    """
    Starts processing a YouTube URL in the background and returns a job_id
    right away. Poll GET /api/video/jobs/{job_id} for progress and the result.
    """
    job_id = job_service.create_job()
    background_tasks.add_task(_run_pipeline, job_id, request.youtube_url)
    return VideoJobCreated(job_id=job_id)


@router.get("/jobs/{job_id}", response_model=VideoJobStatus)
def get_job_status(job_id: str):
    """Returns the current status of a processing job (see job_service.py)."""
    job = job_service.get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found. It may have expired.")

    # Note: this endpoint always returns HTTP 200 -- the pipeline's own error
    # (e.g. 422 for a bad video, 404 for an unavailable one) is carried in the
    # `status`/`error` fields instead, since the job may have failed for a
    # reason that occurred long after this specific GET request was made.
    return VideoJobStatus(
        job_id=job_id,
        status=job["status"],
        stage=job["stage"],
        result=job["result"],
        error=job["error"],
    )