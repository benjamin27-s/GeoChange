import logging
from concurrent.futures import ThreadPoolExecutor
from time import perf_counter
from typing import Any

from fastapi import APIRouter, HTTPException

from backend.app.pipelines.detect_pipeline import run_detect_acquisition
from backend.app.pipelines.forecast_pipeline import run_forecast_acquisition
from backend.app.schemas.detect_schema import DetectRequest
from backend.app.schemas.predict_schema import PredictRequest
from backend.app.services.progress_store import (
    cancel_job,
    create_job,
    is_cancelled,
    set_job_error,
    set_job_result,
    set_job_stage,
)

router = APIRouter(tags=["async inference"])
logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=2)


def _detect_stages() -> list[tuple[int, str]]:
    return [
        (1, "Receiving coordinates"),
        (2, "Querying Sentinel imagery"),
        (3, "Applying cloud filtering"),
        (4, "Selecting scenes"),
        (5, "Downloading bands"),
        (6, "Preprocessing tensors"),
        (7, "Running inference"),
        (8, "Generating heatmap"),
        (9, "Rendering visualization"),
    ]


def _forecast_stages() -> list[tuple[int, str]]:
    # Keep stage UI aligned; names differ slightly for forecast.
    return [
        (1, "Receiving coordinates"),
        (2, "Querying Sentinel imagery"),
        (3, "Applying cloud filtering"),
        (4, "Selecting scenes"),
        (5, "Downloading bands"),
        (6, "Preprocessing tensors"),
        (7, "Running inference"),
        (8, "Generating visualization"),
        (9, "Rendering visualization"),
    ]


def _run_detect_job(job_id: str, request: DetectRequest) -> None:
    try:
        started = perf_counter()
        set_job_stage(job_id, stage_index=1, stage_name="Receiving coordinates", percent=0)
        set_job_stage(job_id, stage_index=2, stage_name="Querying Sentinel imagery")

        if is_cancelled(job_id):
            raise RuntimeError("Job cancelled")

        result = run_detect_acquisition(request, job_id=job_id)
        if not is_cancelled(job_id):
            set_job_result(job_id, result.model_dump())
            set_job_stage(job_id, stage_index=9, stage_name="Rendering visualization", percent=100)
        logger.info("Detect job %s completed in %.1fs", job_id, perf_counter() - started)
    except Exception as exc:
        set_job_error(job_id, str(exc))
        logger.exception("Detect job %s failed", job_id)


def _run_forecast_job(job_id: str, request: PredictRequest) -> None:
    try:
        started = perf_counter()
        set_job_stage(job_id, stage_index=1, stage_name="Receiving coordinates", percent=0)
        set_job_stage(job_id, stage_index=2, stage_name="Querying Sentinel imagery")

        if is_cancelled(job_id):
            raise RuntimeError("Job cancelled")

        result = run_forecast_acquisition(request, job_id=job_id)
        if not is_cancelled(job_id):
            set_job_result(job_id, result.model_dump())
            set_job_stage(job_id, stage_index=9, stage_name="Rendering visualization", percent=100)
        logger.info("Forecast job %s completed in %.1fs", job_id, perf_counter() - started)
    except Exception as exc:
        set_job_error(job_id, str(exc))
        logger.exception("Forecast job %s failed", job_id)


def submit_detect_async(request: DetectRequest) -> dict[str, Any]:
    job_id = create_job("detect")
    _executor.submit(_run_detect_job, job_id, request)
    return {"job_id": job_id}


def submit_forecast_async(request: PredictRequest) -> dict[str, Any]:
    job_id = create_job("forecast")
    _executor.submit(_run_forecast_job, job_id, request)
    return {"job_id": job_id}


@router.get("/jobs/{job_id}")
def get_job_status(job_id: str) -> dict[str, Any]:
    from backend.app.services.progress_store import get_job

    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    payload: dict[str, Any] = {
        "job_id": job_id,
        "status": job.status,
        "workflow": job.workflow,
        "stage": {
            "index": job.stage_index,
            "name": job.stage_name,
            "percent": job.percent,
            "message": job.message,
        },
        "result": job.result,
        "error": job.error,
        "warnings": job.warnings,
    }
    return payload


@router.post("/jobs/{job_id}/cancel")
def cancel_job_endpoint(job_id: str) -> dict[str, Any]:
    ok = cancel_job(job_id)
    if not ok:
        return {"cancelled": False}
    return {"cancelled": True}

