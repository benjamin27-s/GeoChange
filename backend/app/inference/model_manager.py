import logging
import sys
from pathlib import Path

import torch

from backend.app.config import PROJECT_ROOT, settings
from backend.app.inference.device import get_inference_device
from backend.app.pipelines.errors import InferenceError


if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.models.convlstm import ConvLSTM
from src.models.siamese_unet import SiameseUNet


logger = logging.getLogger(__name__)


class ModelManager:
    def __init__(self):
        self.device = get_inference_device()
        self._model1 = None
        self._model1_metadata = None
        self._model2 = None
        self._model2_metadata = None

    def get_change_model(self):
        if self._model1 is None:
            self._model1, self._model1_metadata = self._load_siamese_unet(
                settings.model1_path
            )
        return self._model1, self._model1_metadata

    def get_forecast_model(self):
        if self._model2 is None:
            self._model2, self._model2_metadata = self._load_convlstm(
                settings.model2_path
            )
        return self._model2, self._model2_metadata

    def _load_checkpoint(self, checkpoint_path: Path):
        if not checkpoint_path.exists():
            raise InferenceError(f"Model checkpoint not found: {checkpoint_path}")

        try:
            try:
                checkpoint = torch.load(
                    checkpoint_path,
                    map_location="cpu",
                    weights_only=True,
                )
            except TypeError:
                checkpoint = torch.load(checkpoint_path, map_location="cpu")
        except Exception as exc:
            raise InferenceError(f"Failed to load checkpoint: {checkpoint_path}") from exc

        state_dict = checkpoint.get("model_state_dict", checkpoint)
        if not isinstance(state_dict, dict):
            raise InferenceError(f"Invalid checkpoint format: {checkpoint_path}")

        metadata = {
            "checkpoint": str(checkpoint_path),
            "checkpoint_type": "training_checkpoint"
            if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint
            else "state_dict",
            "epoch": checkpoint.get("epoch") if isinstance(checkpoint, dict) else None,
            "best_val_loss": checkpoint.get("best_val_loss")
            if isinstance(checkpoint, dict)
            else None,
            "val_loss": checkpoint.get("val_loss") if isinstance(checkpoint, dict) else None,
            "val_metrics": checkpoint.get("val_metrics")
            if isinstance(checkpoint, dict)
            else None,
            "device": str(self.device),
        }

        return state_dict, metadata

    def _load_siamese_unet(self, checkpoint_path: Path):
        state_dict, metadata = self._load_checkpoint(checkpoint_path)
        model = SiameseUNet(in_channels=10, out_channels=1).to(self.device)
        model.load_state_dict(state_dict)
        model.eval()
        logger.info("Loaded Siamese U-Net checkpoint from %s", checkpoint_path)
        metadata["architecture"] = "SiameseUNet"
        return model, metadata

    def _load_convlstm(self, checkpoint_path: Path):
        state_dict, metadata = self._load_checkpoint(checkpoint_path)
        feature_channels, hidden_channels = infer_convlstm_shape(state_dict)
        model = ConvLSTM(
            input_channels=10,
            output_channels=9,
            feature_channels=feature_channels,
            hidden_channels=hidden_channels,
        ).to(self.device)
        model.load_state_dict(state_dict)
        model.eval()
        logger.info("Loaded ConvLSTM checkpoint from %s", checkpoint_path)
        metadata.update(
            {
                "architecture": "ConvLSTM",
                "feature_channels": feature_channels,
                "hidden_channels": hidden_channels,
            }
        )
        return model, metadata


def infer_convlstm_shape(state_dict):
    encoder_weight = state_dict.get("encoder.0.weight")
    head_weight = state_dict.get("prediction_head.0.weight")

    if encoder_weight is None or head_weight is None:
        return 64, 64

    return int(encoder_weight.shape[0]), int(head_weight.shape[1])


model_manager = ModelManager()
