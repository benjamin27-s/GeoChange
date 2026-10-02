from backend.app.services.earth_engine.client import initialize_earth_engine
from backend.app.services.imagery.sentinel import (
    fetch_best_scene_for_interval,
    fetch_recent_sequence,
    make_roi_geometry,
)


def fetch_satellite_imagery(roi, start_date=None, end_date=None):
    """Compatibility facade for single-scene Sentinel acquisition."""
    if start_date is None or end_date is None:
        raise ValueError("start_date and end_date are required")

    return fetch_best_scene_for_interval(roi, start_date, end_date)


__all__ = [
    "initialize_earth_engine",
    "make_roi_geometry",
    "fetch_best_scene_for_interval",
    "fetch_recent_sequence",
    "fetch_satellite_imagery",
]
