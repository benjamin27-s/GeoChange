import numpy as np
import torch

from backend.app.inference.postprocessing.preview_images import (
    detection_binary_mask,
    detection_heatmap,
    rgba_png_data_url,
)


def postprocess_detection(logits, t1, t2, threshold=0.5):
    probabilities = torch.sigmoid(logits).detach().cpu().squeeze().numpy()
    probabilities = np.nan_to_num(probabilities, nan=0.0, posinf=1.0, neginf=0.0)
    mask = probabilities >= threshold
    valid_mask = (t1[9] > 0.5) & (t2[9] > 0.5)
    changed = mask & valid_mask
    valid_pixels = int(np.count_nonzero(valid_mask))
    changed_pixels = int(np.count_nonzero(changed))
    total_pixels = int(mask.size)

    valid_probabilities = probabilities[valid_mask]
    changed_probabilities = probabilities[changed]
    heatmap = detection_heatmap(probabilities, valid_mask)
    binary_preview = detection_binary_mask(changed, valid_mask)

    return {
        "threshold": threshold,
        "mask_shape": list(mask.shape),
        "total_pixels": total_pixels,
        "valid_pixels": valid_pixels,
        "changed_pixels": changed_pixels,
        "changed_pixel_percent": (
            (changed_pixels / valid_pixels) * 100.0
            if valid_pixels
            else 0.0
        ),
        "mean_change_probability": float(valid_probabilities.mean())
        if valid_probabilities.size
        else 0.0,
        "max_change_probability": float(valid_probabilities.max())
        if valid_probabilities.size
        else 0.0,
        "mean_positive_confidence": float(changed_probabilities.mean())
        if changed_probabilities.size
        else 0.0,
        "overlays": {
            "heatmap": {
                "kind": "confidence_heatmap",
                "format": "image/png",
                "data_url": rgba_png_data_url(heatmap),
                "opacity": 0.62,
            },
            "binary_mask": {
                "kind": "binary_change_mask",
                "format": "image/png",
                "data_url": rgba_png_data_url(binary_preview),
                "opacity": 0.74,
            },
        },
        "finite": bool(np.isfinite(probabilities).all()),
    }
