from typing import Any

from fastapi import APIRouter, HTTPException

from backend.app.api.async_inference import submit_detect_async
from backend.app.schemas.detect_schema import DetectRequest, DetectResponse
from backend.app.pipelines.detect_pipeline import run_detect_acquisition
from backend.app.pipelines.errors import ImageryNotFoundError, PipelineError


router = APIRouter(tags=["change detection"])


@router.post("/detect/async")
def detect_change_async(request: DetectRequest) -> dict[str, Any]:
    """Start async change detection and return a job id for progress polling."""
    return submit_detect_async(request)


@router.post("/detect", response_model=DetectResponse)
def detect_change(request: DetectRequest):
    """Acquire and preprocess live Sentinel-2 tensors for change detection."""
    try:
        return run_detect_acquisition(request)
    except ImageryNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Unable to assemble a valid Sentinel sequence for this ROI. "
                "Try a land-based location or a shorter date range."
            ),
        ) from exc
    except PipelineError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
