from datetime import date

import math
from pydantic import BaseModel, Field, model_validator


class DetectRequest(BaseModel):
    """Center coordinate + temporal window for change detection."""

    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    start_date: date
    end_date: date

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        today = date.today()
        if self.start_date > today or self.end_date > today:
            raise ValueError("detect dates must be historical; use forecast for future dates")
        return self

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


class DetectResponse(BaseModel):
    status: str
    message: str
    roi: dict[str, float]
    requested_timestamps: list[str] = []
    selected_timestamps: list[str]
    acquisition: dict = {}
    cloud_percentages: list[float | None]
    tensor_shapes: dict[str, list[int]]
    preprocessing: dict
    inference: dict
    timing_ms: dict
    model: dict
    readiness: dict
    warnings: list[str] = []
