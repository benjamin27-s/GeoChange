import numpy as np

from backend.app.config import settings
from backend.app.pipelines.errors import TensorValidationError


def validate_change_inputs(t1, t2):
    _validate_chw_tensor(t1, "T1", expected_channels=10)
    _validate_chw_tensor(t2, "T2", expected_channels=10)

    if t1.shape != t2.shape:
        raise TensorValidationError(f"T1/T2 shape mismatch: {t1.shape} vs {t2.shape}")


def validate_forecast_sequence(sequence):
    if sequence.ndim != 4:
        raise TensorValidationError(
            f"Forecast sequence must have shape (T,C,H,W), got {sequence.shape}"
        )

    expected = (
        settings.forecast_sequence_length,
        10,
        settings.image_size,
        settings.image_size,
    )
    if tuple(sequence.shape) != expected:
        raise TensorValidationError(
            f"Forecast sequence shape must be {expected}, got {sequence.shape}"
        )

    if not np.isfinite(sequence).all():
        raise TensorValidationError("Forecast sequence contains NaN or Inf values")


def _validate_chw_tensor(tensor, name, expected_channels):
    expected_shape = (expected_channels, settings.image_size, settings.image_size)

    if tensor.ndim != 3:
        raise TensorValidationError(f"{name} must have shape (C,H,W), got {tensor.shape}")

    if tuple(tensor.shape) != expected_shape:
        raise TensorValidationError(
            f"{name} shape must be {expected_shape}, got {tensor.shape}"
        )

    if not np.isfinite(tensor).all():
        raise TensorValidationError(f"{name} contains NaN or Inf values")
