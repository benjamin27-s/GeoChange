import math


def bounding_box_from_center(latitude: float, longitude: float, roi_size_km: float):
    """Return min/max lat/lon for a square ROI centered on a coordinate."""
    if roi_size_km <= 0:
        raise ValueError("roi_size_km must be greater than zero")

    half_size_km = roi_size_km / 2.0
    latitude_delta = half_size_km / 111.32
    longitude_scale = 111.32 * math.cos(math.radians(latitude))

    if abs(longitude_scale) < 1e-6:
        raise ValueError("Cannot compute longitude bounds at this latitude")

    longitude_delta = half_size_km / longitude_scale

    return {
        "min_latitude": latitude - latitude_delta,
        "min_longitude": longitude - longitude_delta,
        "max_latitude": latitude + latitude_delta,
        "max_longitude": longitude + longitude_delta,
    }
