from datetime import date

import math
from pydantic import BaseModel, Field


class PredictRequest(BaseModel):
    """Center coordinate + optional lookback for ConvLSTM forecasting."""

    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    lookback_days: int | None = Field(default=None, ge=15, le=365)
    target_date: date | None = None

    def to_roi_dict(self) -> dict[str, float]:
        EARTH_KM_PER_LAT = 111.32
        lat_delta = 1.0 / EARTH_KM_PER_LAT
        lng_scale = EARTH_KM_PER_LAT * math.cos(math.radians(self.latitude))
        lng_delta = 1.0 / abs(lng_scale or EARTH_KM_PER_LAT)

        return {
            "min_latitude": self.latitude - lat_delta,
            "max_latitude": self.latitude + lat_delta,
            "min_longitude": self.longitude - lng_delta,
            "max_longitude": self.longitude + lng_delta,
        }


class PredictResponse(BaseModel):
    status: str
    message: str
    roi: dict[str, float]
    selected_timestamps: list[str]
    cloud_percentages: list[float | None]
    tensor_shapes: dict[str, list[int]]
    preprocessing: dict
    inference: dict
    timing_ms: dict
    model: dict
    readiness: dict
    warnings: list[str] = []
