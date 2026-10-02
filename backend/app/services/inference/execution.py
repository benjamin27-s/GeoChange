from time import perf_counter

import numpy as np
import torch

from backend.app.inference.model_manager import model_manager
from backend.app.inference.postprocessing.detection import postprocess_detection
from backend.app.inference.postprocessing.forecast import postprocess_forecast
from backend.app.inference.validators.tensor_validators import (
    validate_change_inputs,
    validate_forecast_sequence,
)
from backend.app.services.progress_store import is_cancelled, set_job_stage


def run_change_inference(t1, t2, *, job_id: str | None = None):
    validate_change_inputs(t1, t2)
    model, metadata = model_manager.get_change_model()
    device = model_manager.device
    started = perf_counter()

    with torch.no_grad():
        if is_cancelled(job_id):
            raise RuntimeError("Job cancelled")
        if job_id:
            set_job_stage(job_id, stage_index=7, stage_name="Running inference")
        t1_tensor = _to_batch_tensor(t1, device)
        t2_tensor = _to_batch_tensor(t2, device)
        logits = model(t1_tensor, t2_tensor)

    inference_ms = (perf_counter() - started) * 1000.0
    summary = postprocess_detection(logits, t1, t2)
    if job_id:
        set_job_stage(job_id, stage_index=8, stage_name="Generating heatmap")

    return {
        "summary": summary,
        "model_metadata": metadata,
        "timing_ms": inference_ms,
    }


def run_forecast_inference(sequence, *, job_id: str | None = None):
    validate_forecast_sequence(sequence)
    model, metadata = model_manager.get_forecast_model()
    device = model_manager.device
    started = perf_counter()

    with torch.no_grad():
        if is_cancelled(job_id):
            raise RuntimeError("Job cancelled")
        if job_id:
            set_job_stage(job_id, stage_index=7, stage_name="Running inference")
        sequence_tensor = torch.from_numpy(
            np.nan_to_num(sequence, nan=0.0, posinf=0.0, neginf=0.0)
        ).unsqueeze(0).to(device=device, dtype=torch.float32)
        prediction = model(sequence_tensor)

    inference_ms = (perf_counter() - started) * 1000.0
    summary = postprocess_forecast(prediction)
    if job_id:
        set_job_stage(job_id, stage_index=8, stage_name="Generating visualization")

    return {
        "summary": summary,
        "model_metadata": metadata,
        "timing_ms": inference_ms,
    }


def _to_batch_tensor(tensor, device):
    sanitized = np.nan_to_num(tensor, nan=0.0, posinf=0.0, neginf=0.0)
    return torch.from_numpy(sanitized).unsqueeze(0).to(
        device=device,
        dtype=torch.float32,
    )
