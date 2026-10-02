from backend.app.services.preprocessing.live_preprocessor import (
    OUTPUT_CHANNELS,
    build_live_tensor,
    normalize_tensor,
    summarize_tensor,
)


def prepare_model_input(raw_images):
    """Compatibility facade for live Sentinel scene tensorization."""
    return [
        normalize_tensor(build_live_tensor(scene))
        for scene in raw_images
    ]


__all__ = [
    "OUTPUT_CHANNELS",
    "build_live_tensor",
    "normalize_tensor",
    "summarize_tensor",
    "prepare_model_input",
]
