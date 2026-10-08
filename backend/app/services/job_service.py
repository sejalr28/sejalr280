"""
job_service.py
---------------
A tiny in-memory job tracker for long-running work (right now: processing a
video). Lets an endpoint return immediately with a job_id, do the actual work
in the background, and let the frontend poll a status endpoint instead of
holding one HTTP request open for the whole pipeline.

This is intentionally simple (a dict protected by a lock) rather than a real
task queue (Celery, RQ) or a database-backed job table. That is the right
trade-off for a single-process app like this one; if this ever ran across
multiple server processes, jobs would need to live in Redis or a database
instead, since each process would otherwise have its own separate dict.
"""

import threading
import time
import uuid

_lock = threading.Lock()
_jobs: dict[str, dict] = {}

# Jobs older than this are dropped on each create_job() call, so the dict
# doesn't grow forever in a long-running server process.
_MAX_JOB_AGE_SECONDS = 3600


def create_job() -> str:
    """Creates a new job in the 'pending' state and returns its ID."""
    job_id = uuid.uuid4().hex
    with _lock:
        _jobs[job_id] = {
            "status": "pending",   # pending -> processing -> done | error
            "stage": "queued",     # human-readable current step, shown in the UI
            "result": None,
            "error": None,
            "created_at": time.time(),
        }
        _prune_old_jobs()
    return job_id


def set_stage(job_id: str, stage: str) -> None:
    """Marks the job as actively processing and records what step it's on."""
    with _lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "processing"
            _jobs[job_id]["stage"] = stage


def set_done(job_id: str, result: dict) -> None:
    with _lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "done"
            _jobs[job_id]["stage"] = "done"
            _jobs[job_id]["result"] = result


def set_error(job_id: str, message: str, status_code: int = 500) -> None:
    with _lock:
        if job_id in _jobs:
            _jobs[job_id]["status"] = "error"
            _jobs[job_id]["stage"] = "error"
            _jobs[job_id]["error"] = message
            _jobs[job_id]["status_code"] = status_code


def get_job(job_id: str) -> dict | None:
    with _lock:
        job = _jobs.get(job_id)
        return dict(job) if job else None  # copy so callers can't mutate our state


def _prune_old_jobs() -> None:
    """Caller must already hold _lock."""
    cutoff = time.time() - _MAX_JOB_AGE_SECONDS
    stale = [jid for jid, job in _jobs.items() if job["created_at"] < cutoff]
    for jid in stale:
        del _jobs[jid]