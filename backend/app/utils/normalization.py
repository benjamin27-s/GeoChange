import json

import numpy as np

from backend.app.config import settings


def load_normalization_stats(stats_path=None):
    """Load normalization statistics used by model preprocessing and decoding."""
    path = stats_path or settings.normalization_stats_path

    with path.open("r", encoding="utf-8") as file:
        stats = json.load(file)

    return {
        "channels": stats["channels"],
        "mean": np.asarray(stats["mean"], dtype=np.float32),
        "std": np.asarray(stats["std"], dtype=np.float32),
    }


def denormalize_channels(tensor, mean, std):
    """Apply channel-wise denormalization to an array-like tensor."""
    return tensor * std + mean
