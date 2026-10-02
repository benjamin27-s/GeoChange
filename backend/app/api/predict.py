from typing import Any

from fastapi import APIRouter, HTTPException

from backend.app.api.async_inference import submit_forecast_async
from backend.app.pipelines.errors import ImageryNotFoundError, PipelineError
from backend.app.pipelines.forecast_pipeline import run_forecast_acquisition
from backend.app.schemas.predict_schema import PredictRequest, PredictResponse


router = APIRouter(tags=["future prediction"])


@router.post("/predict/async")
def predict_future_async(request: PredictRequest) -> dict[str, Any]:
    """Start async forecast and return a job id for progress polling."""
    return submit_forecast_async(request)


@router.post("/predict", response_model=PredictResponse)
def predict_future(request: PredictRequest):
    """Acquire and preprocess a live Sentinel-2 sequence for forecasting."""
    try:
        return run_forecast_acquisition(request)
    except ImageryNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Unable to assemble a valid Sentinel sequence for this ROI. "
                "Try a land-based location or retry shortly."
            ),
        ) from exc
    except PipelineError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
