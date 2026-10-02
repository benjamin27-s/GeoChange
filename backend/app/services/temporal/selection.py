from datetime import date

from backend.app.config import settings


def detect_temporal_warnings(start_date: date, end_date: date) -> list[str]:
    delta_days = (end_date - start_date).days
    if delta_days > settings.detect_interval_warning_days:
        return [
            "Requested detection interval is wider than the strongest training "
            f"distribution ({settings.detect_interval_warning_days} days)."
        ]

    return []


def forecast_lookback_days(requested_days: int | None) -> int:
    return requested_days or settings.forecast_lookback_days
