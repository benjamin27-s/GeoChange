def build_visualization_payload(asset_paths=None, metadata=None):
    """Placeholder for API responses that point the frontend to visual assets."""
    return {
        "asset_paths": asset_paths or {},
        "metadata": metadata or {},
    }
