import logging
from time import perf_counter

from backend.app.config import settings
from backend.app.schemas.predict_schema import PredictRequest, PredictResponse
from backend.app.services.inference.execution import run_forecast_inference
from backend.app.services.imagery.sentinel import fetch_recent_sequence
from backend.app.services.temporal.selection import forecast_lookback_days
from backend.app.services.tensor_builders.workflow_tensors import build_forecast_tensor
from backend.app.services.progress_store import is_cancelled, set_job_stage
logger = logging.getLogger(__name__)


def run_forecast_acquisition(
    request: PredictRequest,
    *,
    job_id: str | None = None,
) -> PredictResponse:
    total_started = perf_counter()
    roi = request.to_roi_dict()
    lookback_days = forecast_lookback_days(request.lookback_days)

    logger.info("Running live forecast acquisition for ROI=%s", roi)
    if job_id:
        set_job_stage(job_id, stage_index=3, stage_name="Applying cloud filtering")
        set_job_stage(job_id, stage_index=4, stage_name="Selecting scenes")
    if is_cancelled(job_id):
        raise RuntimeError("Job cancelled")
    acquisition_started = perf_counter()
    scenes = fetch_recent_sequence(
        roi,
        lookback_days=lookback_days,
        sequence_length=settings.forecast_sequence_length,
        job_id=job_id,
    )
    acquisition_ms = (perf_counter() - acquisition_started) * 1000.0

    if is_cancelled(job_id):
        raise RuntimeError("Job cancelled")

    if job_id:
        set_job_stage(job_id, stage_index=6, stage_name="Preprocessing tensors")
    preprocessing_started = perf_counter()
    tensors = build_forecast_tensor(scenes)
    preprocessing_ms = (perf_counter() - preprocessing_started) * 1000.0

    if is_cancelled(job_id):
        raise RuntimeError("Job cancelled")

    inference_result = run_forecast_inference(tensors["sequence"], job_id=job_id)
    total_ms = (perf_counter() - total_started) * 1000.0

    if job_id:
        set_job_stage(job_id, stage_index=9, stage_name="Rendering visualization", percent=100)

    return PredictResponse(
        status="success",
        message="Live Sentinel-2 temporal sequence and ConvLSTM inference complete.",
        roi=roi,
        selected_timestamps=[
            scene.timestamp.isoformat()
            for scene in scenes
        ],
        cloud_percentages=[
            scene.cloud_percentage
            for scene in scenes
        ],
        tensor_shapes={
            "sequence": list(tensors["sequence"].shape),
        },
        preprocessing={
            "channel_order": tensors["summaries"]["sequence"]["channel_order"],
            "normalization": "applied using normalization_stats.json",
            "sequence_order": "oldest_to_newest",
            "reflectance_scaling": "bands divided by 10000 and clipped to [0, 1]",
            "indices": "NDVI=(B8-B4)/(B8+B4+1e-6), NDMI=(B8-B11)/(B8+B11+1e-6)",
            "mask": "per-frame Sentinel-2 selected-band validity mask",
            "summaries": tensors["summaries"],
        },
        inference={
            "workflow": "forecast",
            "output": "predicted_t4_tensor_summary",
            "statistics": inference_result["summary"],
        },
        timing_ms={
            "acquisition": acquisition_ms,
            "preprocessing": preprocessing_ms,
            "inference": inference_result["timing_ms"],
            "total": total_ms,
        },
        model=inference_result["model_metadata"],
        readiness={
            "workflow": "forecast",
            "model": "convlstm",
            "model_ready": True,
            "inference_executed": True,
            "lookback_days": lookback_days,
        },
        warnings=[],
    )
