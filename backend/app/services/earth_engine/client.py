import logging

import ee

from backend.app.config import settings
from backend.app.pipelines.errors import EarthEngineUnavailableError


logger = logging.getLogger(__name__)
_initialized = False


def initialize_earth_engine():
    """Initialize Earth Engine once using environment-driven configuration."""
    global _initialized

    if _initialized:
        return ee

    try:
        if settings.ee_service_account and settings.ee_private_key_path:
            credentials = ee.ServiceAccountCredentials(
                settings.ee_service_account,
                str(settings.ee_private_key_path),
            )
            ee.Initialize(credentials, project=settings.ee_project_id)
        else:
            ee.Initialize(project=settings.ee_project_id)
    except Exception as exc:
        logger.exception("Earth Engine initialization failed")
        raise EarthEngineUnavailableError(
            "Earth Engine is not initialized. Configure EE_PROJECT_ID and run "
            "Earth Engine authentication before using live acquisition."
        ) from exc

    _initialized = True
    logger.info("Earth Engine initialized with project=%s", settings.ee_project_id)
    return ee
