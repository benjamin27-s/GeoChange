import logging
from time import perf_counter

from backend.app.schemas.detect_schema import DetectRequest, DetectResponse
from backend.app.services.inference.execution import run_change_inference
from backend.app.inference.postprocessing.preview_images import rgb_png_data_url
from backend.app.services.imagery.sentinel import fetch_scene_near_date
from backend.app.services.temporal.selection import detect_temporal_warnings
from backend.app.services.tensor_builders.workflow_tensors import build_detect_tensors
from backend.app.pipelines.errors import ImageryNotFoundError
from backend.app.services.progress_store import is_cancelled, set_job_stage
logger = logging.getLogger(__name__)


def run_detect_acquisition(
    request: DetectRequest,
    *,
    job_id: str | None = None,
) -> DetectResponse:
    total_started = perf_counter()
    roi = request.to_roi_dict()

    logger.info("Running live detect acquisition for ROI=%s", roi)
    logger.info(
        "DetectRequest temporal validation requested: T1=%s T2=%s",
        request.start_date.isoformat(),
        request.end_date.isoformat(),
    )
    acquisition_started = perf_counter()
    if job_id:
        set_job_stage(job_id, stage_index=3, stage_name="Applying cloud filtering")
        set_job_stage(job_id, stage_index=4, stage_name="Selecting scenes")
    if is_cancelled(job_id):
        raise RuntimeError("Job cancelled")

    t1_scene, t1_meta = fetch_scene_near_date(
        roi,
        request.start_date,
        job_id=job_id,
    )
    logger.info(
        "Selected T1 scene image_id=%s timestamp=%s cloud=%s meta=%s",
        t1_scene.image_id,
        t1_scene.timestamp.isoformat(),
        t1_scene.cloud_percentage,
        t1_meta,
    )

    if is_cancelled(job_id):
        raise RuntimeError("Job cancelled")

    t2_excluded_image_id = (
        t1_scene.image_id if request.start_date != request.end_date else None
    )
    t2_scene, t2_meta = fetch_scene_near_date(
        roi,
        request.end_date,
        lookback_only=True,
        exclude_image_id=t2_excluded_image_id,
        job_id=job_id,
    )

    identical_image_id = t1_scene.image_id == t2_scene.image_id
    identical_timestamp = t1_scene.timestamp == t2_scene.timestamp
    fallback_triggered_t1 = bool(t1_meta.get("adaptive_selection"))
    fallback_triggered_t2 = bool(t2_meta.get("adaptive_selection"))

    logger.info(
        "Selected T2 scene image_id=%s timestamp=%s cloud=%s meta=%s (identical_image_id=%s identical_timestamp=%s fallback_t1=%s fallback_t2=%s)",
        t2_scene.image_id,
        t2_scene.timestamp.isoformat(),
        t2_scene.cloud_percentage,
        t2_meta,
        identical_image_id,
        identical_timestamp,
        fallback_triggered_t1,
        fallback_triggered_t2,
    )

    # Defense-in-depth: never silently reuse T1 as T2 when dates differ.
    if request.start_date != request.end_date and identical_image_id:
        logger.warning(
            "T1 and T2 selection reused the same Sentinel scene (image_id=%s). Retrying T2 with that scene excluded to prevent silent reuse.",
            t1_scene.image_id,
        )
        t2_scene, t2_meta = fetch_scene_near_date(
            roi,
            request.end_date,
            lookback_only=True,
            exclude_image_id=t1_scene.image_id,
            job_id=job_id,
        )

        if t2_scene.image_id == t1_scene.image_id:
            # Should be unreachable if exclusion works, but treat as a hard failure.
            raise ImageryNotFoundError(
                "No valid T2 Sentinel scene found after excluding the selected T1 scene"
            )

    logger.info(
        "Detect scene selection finalized requested_T1=%s requested_T2=%s "
        "selected_T1=%s image_id_T1=%s selected_T2=%s image_id_T2=%s "
        "image_ids_match=%s t2_excluded_image_id=%s fallback_reason_T1=%s fallback_reason_T2=%s",
        request.start_date.isoformat(),
        request.end_date.isoformat(),
        t1_scene.timestamp.isoformat(),
        t1_scene.image_id,
        t2_scene.timestamp.isoformat(),
        t2_scene.image_id,
        t1_scene.image_id == t2_scene.image_id,
        t2_excluded_image_id,
        t1_meta.get("fallback_reason"),
        t2_meta.get("fallback_reason"),
    )
    acquisition_ms = (perf_counter() - acquisition_started) * 1000.0

    if is_cancelled(job_id):
        raise RuntimeError("Job cancelled")

    if job_id:
        set_job_stage(job_id, stage_index=6, stage_name="Preprocessing tensors")
    preprocessing_started = perf_counter()
    tensors = build_detect_tensors([t1_scene, t2_scene])
    preprocessing_ms = (perf_counter() - preprocessing_started) * 1000.0

    if is_cancelled(job_id):
        raise RuntimeError("Job cancelled")

    inference_result = run_change_inference(tensors["T1"], tensors["T2"], job_id=job_id)
    warnings = detect_temporal_warnings(request.start_date, request.end_date)
    total_ms = (perf_counter() - total_started) * 1000.0

    raw_t1 = tensors["raw_tensors"][0]
    raw_t2 = tensors["raw_tensors"][1]
    
    import numpy as np
    t1_rgb = np.clip(raw_t1[:, :, [2, 1, 0]] * 255.0, 0, 255).astype(np.uint8)
    t2_rgb = np.clip(raw_t2[:, :, [2, 1, 0]] * 255.0, 0, 255).astype(np.uint8)

    inference_result["summary"]["overlays"]["t1"] = {
        "kind": "t1_rgb_preview",
        "format": "image/png",
        "data_url": rgb_png_data_url(t1_rgb),
    }
    inference_result["summary"]["overlays"]["t2"] = {
        "kind": "t2_rgb_preview",
        "format": "image/png",
        "data_url": rgb_png_data_url(t2_rgb),
    }

    if job_id:
        set_job_stage(job_id, stage_index=9, stage_name="Rendering visualization", percent=100)

    return DetectResponse(
        status="success",
        message="Live Sentinel-2 acquisition and Siamese U-Net inference complete.",
        roi=roi,
        requested_timestamps=[
            request.start_date.isoformat(),
            request.end_date.isoformat(),
        ],
        selected_timestamps=[
            t1_scene.timestamp.isoformat(),
            t2_scene.timestamp.isoformat(),
        ],
        acquisition={"T1": t1_meta, "T2": t2_meta},
        cloud_percentages=[
            t1_scene.cloud_percentage,
            t2_scene.cloud_percentage,
        ],
        tensor_shapes={
            "T1": list(tensors["T1"].shape),
            "T2": list(tensors["T2"].shape),
        },
        preprocessing={
            "channel_order": tensors["summaries"]["T1"]["channel_order"],
            "normalization": "applied using normalization_stats.json",
            "reflectance_scaling": "bands divided by 10000 and clipped to [0, 1]",
            "indices": "NDVI=(B8-B4)/(B8+B4+1e-6), NDMI=(B8-B11)/(B8+B11+1e-6)",
            "mask": "intersection of Sentinel-2 selected-band validity masks",
            "summaries": tensors["summaries"],
        },
        inference={
            "workflow": "detect",
            "output": "binary_change_mask_summary",
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
            "workflow": "detect",
            "model": "siamese_unet",
            "model_ready": True,
            "inference_executed": True,
        },
        warnings=warnings,
    )
