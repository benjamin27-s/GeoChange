from backend.app.config import settings
from backend.app.schemas.detect_schema import DetectRequest, DetectResponse
from backend.app.utils.roi import bounding_box_from_center


def load_model1():
    """Placeholder for loading the Model 1 change-detection checkpoint."""
    return {
        "model_path": str(settings.model1_path),
        "device": settings.device,
        "loaded": False,
    }


def run_detection(request: DetectRequest) -> DetectResponse:
    """Return placeholder detection output until full inference is wired in."""
    roi = bounding_box_from_center(
        latitude=request.latitude,
        longitude=request.longitude,
        roi_size_km=settings.default_roi_size_km,
    )

    return DetectResponse(
        status="placeholder",
        message="Change detection inference is not implemented yet.",
        roi=roi,
        model_path=str(settings.model1_path),
    )
