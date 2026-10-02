from pathlib import Path
import os

import torch
from pydantic import BaseModel


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = PROJECT_ROOT / "backend"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file(BACKEND_ROOT / ".env")


class Settings(BaseModel):
    """Central application settings for backend services."""

    model1_path: Path = PROJECT_ROOT / "models" / "siamese_unet.pth"
    model2_path: Path = PROJECT_ROOT / "models" / "convlstm.pth"
    normalization_stats_path: Path = PROJECT_ROOT / "normalization_stats.json"
    default_roi_size_km: float = 10.0
    image_size: int = 256
    max_cloud_percent: float = 20.0
    ee_project_id: str | None = os.getenv("EE_PROJECT_ID")
    ee_service_account: str | None = os.getenv("EE_SERVICE_ACCOUNT")
    ee_private_key_path: Path | None = (
        Path(os.environ["EE_PRIVATE_KEY_PATH"])
        if os.getenv("EE_PRIVATE_KEY_PATH")
        else None
    )
    sentinel_collection: str = "COPERNICUS/S2_SR_HARMONIZED"
    sentinel_scale_m: int = 10
    detect_interval_warning_days: int = 45
    forecast_sequence_length: int = 3
    forecast_lookback_days: int = 90
    temporal_max_gap_days: int = 8
    device: str = "cuda" if torch.cuda.is_available() else "cpu"


settings = Settings()
