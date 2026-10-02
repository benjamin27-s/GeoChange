import numpy as np
import torch
import torch.nn.functional as F

from backend.app.config import settings

from backend.app.services.preprocessing.live_preprocessor import (
    build_live_tensor,
    MASK_INDEX,
    NORMALIZED_CHANNELS,
    normalize_tensor,
    summarize_tensor,
)


def build_detect_tensors(scenes):
    raw_tensors = [build_live_tensor(scene) for scene in scenes]
    normalized = [normalize_tensor(tensor) for tensor in raw_tensors]
    model_tensors = [_resize_hwc_to_chw(tensor) for tensor in normalized]

    return {
        "T1": model_tensors[0],
        "T2": model_tensors[1],
        "raw_tensors": raw_tensors,
        "summaries": {
            "T1": summarize_tensor(normalized[0]),
            "T2": summarize_tensor(normalized[1]),
            "T1_model": _summarize_model_tensor(model_tensors[0]),
            "T2_model": _summarize_model_tensor(model_tensors[1]),
        },
    }


def build_forecast_tensor(scenes):
    raw_tensors = [build_live_tensor(scene) for scene in scenes]
    normalized = [normalize_tensor(tensor) for tensor in raw_tensors]
    model_frames = [_resize_hwc_to_chw(tensor) for tensor in normalized]
    sequence = np.stack(model_frames, axis=0).astype(np.float32, copy=False)

    return {
        "sequence": sequence,
        "summaries": {
            "sequence": {
                "shape": list(sequence.shape),
                "dtype": str(sequence.dtype),
                "finite": bool(np.isfinite(sequence).all()),
                "channel_order": summarize_tensor(normalized[0])["channel_order"],
            },
            "frames": [
                summarize_tensor(tensor)
                for tensor in normalized
            ],
        },
    }


def _resize_hwc_to_chw(tensor):
    image = torch.from_numpy(np.transpose(tensor, (2, 0, 1))).unsqueeze(0)
    resized = F.interpolate(
        image,
        size=(settings.image_size, settings.image_size),
        mode="bilinear",
        align_corners=False,
    ).squeeze(0)
    return resized.numpy().astype(np.float32, copy=False)


def _summarize_model_tensor(tensor):
    return {
        "shape": list(tensor.shape),
        "dtype": str(tensor.dtype),
        "finite": bool(np.isfinite(tensor).all()),
        "layout": "C,H,W",
        "resize": f"{settings.image_size}x{settings.image_size}",
        "normalized_channels": NORMALIZED_CHANNELS,
        "mask_channel_index": MASK_INDEX,
    }
