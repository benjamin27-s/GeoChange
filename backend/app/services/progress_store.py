from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock
from uuid import uuid4


class JobCancelledError(RuntimeError):
    pass


@dataclass
class JobProgress:
    status: str  # running | completed | error | cancelled
    workflow: str | None = None
    stage_index: int | None = None
    stage_name: str | None = None
    percent: float | None = None
    message: str | None = None
    updated_at: str | None = None
    error: str | None = None
    result: dict | None = None
    warnings: list[str] | None = None


_jobs: dict[str, JobProgress] = {}
_lock = Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_job(workflow: str) -> str:
    job_id = str(uuid4())
    with _lock:
        _jobs[job_id] = JobProgress(
            status="running",
            workflow=workflow,
            stage_index=0,
            stage_name=None,
            percent=None,
            message=None,
            updated_at=_now_iso(),
        )
    return job_id


def get_job(job_id: str) -> JobProgress | None:
    with _lock:
        job = _jobs.get(job_id)
        return None if job is None else JobProgress(**job.__dict__)


def cancel_job(job_id: str) -> bool:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return False
        if job.status in ("completed", "error", "cancelled"):
            return False
        job.status = "cancelled"
        job.error = "Cancelled by user"
        job.updated_at = _now_iso()
        return True


def is_cancelled(job_id: str | None) -> bool:
    if not job_id:
        return False
    with _lock:
        job = _jobs.get(job_id)
        return bool(job and job.status == "cancelled")


def set_job_stage(
    job_id: str,
    *,
    stage_index: int,
    stage_name: str,
    percent: float | None = None,
    message: str | None = None,
) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job.stage_index = stage_index
        job.stage_name = stage_name
        job.percent = percent
        job.message = message
        job.updated_at = _now_iso()


def set_job_result(job_id: str, result: dict) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return
        job.status = "completed"
        job.result = result
        job.updated_at = _now_iso()


def set_job_error(job_id: str, error: str, *, warnings: list[str] | None = None) -> None:
    with _lock:
        job = _jobs.get(job_id)
        if not job:
            return
        if job.status == "cancelled":
            return
        job.status = "error"
        job.error = error
        job.warnings = warnings
        job.updated_at = _now_iso()

