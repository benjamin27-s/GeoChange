import base64
import io

import numpy as np
from PIL import Image


def rgba_png_data_url(rgba_array):
    image = Image.fromarray(rgba_array.astype(np.uint8), mode="RGBA")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def rgb_png_data_url(rgb_array):
    image = Image.fromarray(rgb_array.astype(np.uint8), mode="RGB")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def detection_heatmap(probabilities, valid_mask):
    normalized = np.clip(probabilities, 0.0, 1.0)
    rgba = np.zeros((*normalized.shape, 4), dtype=np.uint8)
    rgba[..., 0] = np.clip(255 * normalized, 0, 255).astype(np.uint8)
    rgba[..., 1] = np.clip(220 * (1.0 - np.abs(normalized - 0.55)), 0, 220).astype(np.uint8)
    rgba[..., 2] = np.clip(80 * (1.0 - normalized), 0, 80).astype(np.uint8)
    rgba[..., 3] = np.where(valid_mask, np.clip(210 * normalized, 0, 210), 0).astype(np.uint8)
    return rgba


def detection_binary_mask(changed_mask, valid_mask):
    rgba = np.zeros((*changed_mask.shape, 4), dtype=np.uint8)
    rgba[..., 0] = 255
    rgba[..., 1] = 64
    rgba[..., 2] = 96
    rgba[..., 3] = np.where(changed_mask & valid_mask, 210, 0).astype(np.uint8)
    return rgba


def forecast_rgb_preview(rgb_chw):
    rgb_hwc = np.transpose(np.clip(rgb_chw, 0.0, 1.0), (1, 2, 0))
    return (rgb_hwc * 255).astype(np.uint8)
