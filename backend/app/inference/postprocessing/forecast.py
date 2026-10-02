import numpy as np

from backend.app.inference.postprocessing.preview_images import (
    forecast_rgb_preview,
    rgb_png_data_url,
)
from backend.app.utils.normalization import load_normalization_stats


RGB_CHANNEL_INDICES = (2, 1, 0)


def postprocess_forecast(prediction):
    prediction = prediction.detach().cpu().squeeze(0).numpy().astype(np.float32)
    prediction = np.nan_to_num(prediction, nan=0.0, posinf=0.0, neginf=0.0)
    denormalized = denormalize_prediction(prediction)
    rgb = np.clip(denormalized[list(RGB_CHANNEL_INDICES)], 0.0, 1.0)
    rgb_preview = forecast_rgb_preview(rgb)

    return {
        "prediction_shape": list(prediction.shape),
        "prediction_dtype": str(prediction.dtype),
        "normalized_stats": tensor_stats(prediction),
        "denormalized_stats": tensor_stats(denormalized),
        "rgb_preview": {
            "layout": "C,H,W",
            "channels": ["B4", "B3", "B2"],
            "shape": list(rgb.shape),
            "stats": tensor_stats(rgb),
            "ready_for_visualization": True,
            "format": "image/png",
            "data_url": rgb_png_data_url(rgb_preview),
            "opacity": 0.78,
        },
        "finite": bool(np.isfinite(prediction).all()),
    }


def denormalize_prediction(prediction):
    stats = load_normalization_stats()
    mean = stats["mean"].reshape(-1, 1, 1)
    std = stats["std"].reshape(-1, 1, 1)
    std = np.where(std == 0.0, 1.0, std)
    return prediction * std + mean


def tensor_stats(tensor):
    return {
        "min": float(np.min(tensor)),
        "max": float(np.max(tensor)),
        "mean": float(np.mean(tensor)),
        "std": float(np.std(tensor)),
    }
