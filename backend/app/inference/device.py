import logging

import torch

from backend.app.config import settings


logger = logging.getLogger(__name__)


def get_inference_device():
    if settings.device == "cuda" and not torch.cuda.is_available():
        logger.warning("CUDA requested but unavailable; falling back to CPU")
        return torch.device("cpu")

    return torch.device(settings.device)


def device_summary(device):
    return {
        "device": str(device),
        "cuda_available": torch.cuda.is_available(),
        "cuda_device_count": torch.cuda.device_count(),
        "cuda_device_name": (
            torch.cuda.get_device_name(device)
            if device.type == "cuda"
            else None
        ),
    }
