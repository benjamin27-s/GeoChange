from backend.app.config import settings
from backend.app.schemas.predict_schema import PredictRequest, PredictResponse
from backend.app.utils.roi import bounding_box_from_center


def load_model2():
    """Placeholder for loading the Model 2 ConvLSTM checkpoint."""
    return {
        "model_path": str(settings.model2_path),
        "device": settings.device,
        "loaded": False,
    }


def run_prediction(request: PredictRequest) -> PredictResponse:
    """Return placeholder prediction output until ConvLSTM inference is wired in."""
    roi = bounding_box_from_center(
        latitude=request.latitude,
        longitude=request.longitude,
        roi_size_km=settings.default_roi_size_km,
    )

    return PredictResponse(
        status="placeholder",
        message="Future-frame prediction inference is not implemented yet.",
        roi=roi,
        model_path=str(settings.model2_path),
    )
