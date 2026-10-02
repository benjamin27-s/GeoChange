from datetime import date

import numpy as np

from backend.app.utils.normalization import load_normalization_stats


OUTPUT_CHANNELS = [
    "B2",
    "B3",
    "B4",
    "B8",
    "B11",
    "B12",
    "NDVI",
    "NDMI",
    "DOY",
    "MASK",
]
NORMALIZED_CHANNELS = OUTPUT_CHANNELS[:-1]
MASK_INDEX = 9


def build_live_tensor(scene) -> np.ndarray:
    """Build the exact 10-channel tensor contract used by training preprocessing."""
    source = scene.tensor_source
    bands = np.stack(
        [source[band] for band in OUTPUT_CHANNELS[:6]],
        axis=-1,
    ).astype(np.float32)

    valid_mask = np.all(np.isfinite(bands), axis=-1) & (source["MASK"] > 0)
    bands = bands / 10000.0
    bands = np.clip(bands, 0.0, 1.0)

    b4 = bands[:, :, 2]
    b8 = bands[:, :, 3]
    b11 = bands[:, :, 4]

    ndvi = (b8 - b4) / (b8 + b4 + 1e-6)
    ndmi = (b8 - b11) / (b8 + b11 + 1e-6)
    doy = _make_doy_channel(scene.timestamp, bands.shape[0], bands.shape[1])
    mask = valid_mask.astype(np.float32)

    tensor = np.concatenate(
        [
            bands,
            ndvi[:, :, None].astype(np.float32),
            ndmi[:, :, None].astype(np.float32),
            doy[:, :, None],
            mask[:, :, None],
        ],
        axis=-1,
    )

    return tensor.astype(np.float32)


def normalize_tensor(tensor: np.ndarray) -> np.ndarray:
    stats = load_normalization_stats()
    mean = stats["mean"]
    std = np.where(stats["std"] == 0.0, 1.0, stats["std"])
    normalized = tensor.copy()
    normalized[:, :, : len(NORMALIZED_CHANNELS)] = (
        normalized[:, :, : len(NORMALIZED_CHANNELS)] - mean
    ) / std
    return normalized.astype(np.float32, copy=False)


def summarize_tensor(tensor: np.ndarray) -> dict:
    valid_mask = tensor[:, :, MASK_INDEX] == 1
    valid_pixels = int(np.count_nonzero(valid_mask))
    total_pixels = int(valid_mask.size)

    return {
        "shape": list(tensor.shape),
        "dtype": str(tensor.dtype),
        "valid_pixels": valid_pixels,
        "total_pixels": total_pixels,
        "valid_ratio": valid_pixels / total_pixels if total_pixels else 0.0,
        "finite": bool(np.isfinite(tensor).all()),
        "channel_order": OUTPUT_CHANNELS,
    }


def _make_doy_channel(timestamp: date, height: int, width: int) -> np.ndarray:
    doy_value = timestamp.timetuple().tm_yday / 365.0
    return np.full((height, width), doy_value, dtype=np.float32)
