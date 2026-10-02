from dataclasses import dataclass
from datetime import date, datetime, timedelta
import io
import logging
import zipfile

import numpy as np
import rasterio
from rasterio.io import MemoryFile
import requests

from backend.app.config import settings
from backend.app.pipelines.errors import ImageryNotFoundError, PreprocessingError
from backend.app.services.earth_engine.client import initialize_earth_engine
from backend.app.services.progress_store import JobCancelledError, is_cancelled, set_job_stage


logger = logging.getLogger(__name__)

SENTINEL_BANDS = ("B2", "B3", "B4", "B8", "B11", "B12")
TEN_M_BANDS = ("B2", "B3", "B4", "B8")
TWENTY_M_BANDS = ("B11", "B12")
MASK_BAND = "MASK"


@dataclass(frozen=True)
class SentinelScene:
    image_id: str
    timestamp: date
    cloud_percentage: float | None
    tensor_source: dict[str, np.ndarray]


def make_roi_geometry(roi):
    ee = initialize_earth_engine()
    return ee.Geometry.Rectangle(
        [
            roi["min_longitude"],
            roi["min_latitude"],
            roi["max_longitude"],
            roi["max_latitude"],
        ],
        proj="EPSG:4326",
        geodesic=False,
    )


def fetch_best_scene_for_interval(
    roi,
    start_date: date,
    end_date: date,
    max_cloud_percent: float = None,
    *,
    exclude_image_id: str | None = None,
    job_id: str | None = None,
) -> SentinelScene:
    if is_cancelled(job_id):
        raise JobCancelledError("Job cancelled")
    ee = initialize_earth_engine()
    geometry = make_roi_geometry(roi)
    collection = _sentinel_collection(
        geometry,
        start_date,
        end_date,
        max_cloud_percent,
        exclude_image_id=exclude_image_id,
    )
    image = collection.first()

    size = int(collection.size().getInfo())
    logger.info(
        "Sentinel interval query ROI=%s start=%s end=%s cloud_thresh=%s collection_size=%d",
        roi,
        start_date.isoformat(),
        end_date.isoformat(),
        max_cloud_percent if max_cloud_percent is not None else settings.max_cloud_percent,
        size,
    )

    if size == 0:
        raise ImageryNotFoundError(
            f"No Sentinel-2 SR scene found for ROI between {start_date} and {end_date}"
        )

    # Log a small slice of candidate low-cloud scenes from GEE for debuggability.
    # NOTE: This adds extra `getInfo()` calls, so keep it small.
    max_candidates = 5
    candidate_count = min(size, max_candidates)
    candidate_list = collection.toList(candidate_count)
    candidates = []
    for idx in range(candidate_count):
        candidate = ee.Image(candidate_list.get(idx))
        image_id = str(candidate.get("system:index").getInfo())
        timestamp_ms = int(candidate.get("system:time_start").getInfo())
        timestamp = datetime.utcfromtimestamp(timestamp_ms / 1000).date()
        cloud = candidate.get("CLOUDY_PIXEL_PERCENTAGE").getInfo()
        candidates.append(
            {
                "image_id": image_id,
                "timestamp": timestamp.isoformat(),
                "cloud_percentage": cloud,
            }
        )
    logger.info(
        "Sentinel candidate scenes start=%s end=%s cloud_thresh=%s (top=%d) %s",
        start_date.isoformat(),
        end_date.isoformat(),
        max_cloud_percent if max_cloud_percent is not None else settings.max_cloud_percent,
        candidate_count,
        candidates,
    )

    return _download_scene(image, geometry, job_id=job_id)


def fetch_scene_near_date(
    roi,
    anchor_date: date,
    *,
    lookback_only: bool = False,
    max_span_days: int = 180,
    exclude_image_id: str | None = None,
    job_id: str | None = None,
) -> tuple[SentinelScene, dict]:
    """Select the nearest low-cloud Sentinel scene around an anchor date."""
    if is_cancelled(job_id):
        raise JobCancelledError("Job cancelled")
    search_spans = [8, 15, 30, 60, max_span_days]
    cloud_thresholds = [10.0, 20.0, 35.0, settings.max_cloud_percent]

    for threshold in cloud_thresholds:
        seen = set()
        for span in search_spans:
            if span in seen:
                continue
            seen.add(span)

            if lookback_only:
                start_date = anchor_date - timedelta(days=span)
                end_date = anchor_date
            else:
                start_date = anchor_date - timedelta(days=span)
                end_date = anchor_date + timedelta(days=span)

            try:
                scene = fetch_best_scene_for_interval(
                    roi,
                    start_date,
                    end_date,
                    max_cloud_percent=threshold,
                    exclude_image_id=exclude_image_id,
                    job_id=job_id,
                )
            except ImageryNotFoundError:
                continue

            metadata = {
                "requested_date": anchor_date.isoformat(),
                "actual_date": scene.timestamp.isoformat(),
                "search_span_days": span,
                "cloud_threshold": threshold,
                "adaptive_selection": scene.timestamp != anchor_date,
                "fallback_reason": "nearest_available_low_cloud_scene"
                if scene.timestamp != anchor_date
                else "exact_date_low_cloud_scene",
                "excluded_image_id": exclude_image_id,
                "image_id": scene.image_id,
            }
            logger.info(
                "Adaptive scene for anchor %s -> %s image_id=%s excluded_image_id=%s "
                "(span=%sd, cloud_thresh=%s, reason=%s)",
                anchor_date,
                scene.timestamp,
                scene.image_id,
                exclude_image_id,
                span,
                threshold,
                metadata["fallback_reason"],
            )
            return scene, metadata

    logger.warning(
        "No suitable Sentinel-2 scene found for anchor=%s max_span_days=%s excluded_image_id=%s",
        anchor_date,
        max_span_days,
        exclude_image_id,
    )
    raise ImageryNotFoundError(
        f"No suitable Sentinel-2 scene found within {max_span_days} days of {anchor_date}"
    )


def fetch_recent_sequence(
    roi,
    lookback_days: int,
    sequence_length: int,
    *,
    job_id: str | None = None,
) -> list[SentinelScene]:
    for span in _expand_lookback_windows(lookback_days):
        try:
            return _fetch_recent_sequence_for_window(
                roi,
                span,
                sequence_length,
                job_id=job_id,
            )
        except ImageryNotFoundError:
            logger.info("Expanding forecast lookback beyond %s days", span)
            continue

    raise ImageryNotFoundError(
        f"Unable to assemble {sequence_length} Sentinel-2 scenes for the selected ROI"
    )


def _expand_lookback_windows(initial_days: int):
    spans = [initial_days, max(initial_days * 2, 60), 120, 180, 365]
    seen = set()
    for span in spans:
        if span not in seen:
            seen.add(span)
            yield span


def _fetch_recent_sequence_for_window(
    roi,
    lookback_days: int,
    sequence_length: int,
    *,
    job_id: str | None = None,
) -> list[SentinelScene]:
    if is_cancelled(job_id):
        raise JobCancelledError("Job cancelled")
    ee = initialize_earth_engine()
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=lookback_days)
    geometry = make_roi_geometry(roi)
    collection = _sentinel_collection(geometry, start_date, end_date)
    size = int(collection.size().getInfo())

    if size < sequence_length:
        raise ImageryNotFoundError(
            f"Only {size} Sentinel-2 scenes found in the last {lookback_days} days; "
            f"{sequence_length} are required"
        )

    image_list = collection.sort("system:time_start", False).toList(sequence_length)
    scenes = []
    for index in range(sequence_length):
        scenes.append(
            _download_scene(
                ee.Image(image_list.get(index)),
                geometry,
                job_id=job_id,
            )
        )

    return list(reversed(scenes))


def _sentinel_collection(
    geometry,
    start_date: date,
    end_date: date,
    max_cloud_percent: float = None,
    exclude_image_id: str | None = None,
):
    ee = initialize_earth_engine()
    exclusive_end = end_date + timedelta(days=1)
    
    threshold = max_cloud_percent if max_cloud_percent is not None else settings.max_cloud_percent

    collection = (
        ee.ImageCollection(settings.sentinel_collection)
        .filterBounds(geometry)
        .filterDate(start_date.isoformat(), exclusive_end.isoformat())
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", threshold))
        .sort("CLOUDY_PIXEL_PERCENTAGE")
    )

    if exclude_image_id:
        # Prevent silent T1->T2 reuse: exclude the previously selected scene.
        collection = collection.filter(ee.Filter.neq("system:index", exclude_image_id))

    return collection


def _prepare_download_image(image, geometry):
    high_res = image.select(list(TEN_M_BANDS)).toFloat()
    medium_res = image.select(list(TWENTY_M_BANDS)).resample("bilinear").toFloat()
    mask = image.select(list(SENTINEL_BANDS)).mask().reduce("min").rename(MASK_BAND)

    return high_res.addBands(medium_res).addBands(mask).clip(geometry)


def _download_scene(image, geometry, *, job_id: str | None = None) -> SentinelScene:
    if is_cancelled(job_id):
        raise JobCancelledError("Job cancelled")
    ee = initialize_earth_engine()
    image_id = str(image.get("system:index").getInfo())
    timestamp_ms = int(image.get("system:time_start").getInfo())
    timestamp = datetime.utcfromtimestamp(timestamp_ms / 1000).date()
    cloud = image.get("CLOUDY_PIXEL_PERCENTAGE").getInfo()
    prepared = _prepare_download_image(image, geometry)

    url = prepared.getDownloadURL(
        {
            "scale": settings.sentinel_scale_m,
            "region": geometry,
            "format": "GEO_TIFF",
            "filePerBand": False,
            "bands": list(SENTINEL_BANDS) + [MASK_BAND],
        }
    )

    logger.info("Downloading Sentinel scene %s at %s", image_id, timestamp)
    if job_id:
        set_job_stage(
            job_id,
            stage_index=5,
            stage_name="Downloading bands",
            message=f"Scene={image_id}",
        )
    if is_cancelled(job_id):
        raise JobCancelledError("Job cancelled")
    try:
        response = requests.get(url, timeout=120)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise ImageryNotFoundError(
            f"Earth Engine Sentinel download failed for scene {image_id}: {exc}"
        ) from exc

    arrays = _read_downloaded_geotiff(response.content)

    return SentinelScene(
        image_id=image_id,
        timestamp=timestamp,
        cloud_percentage=float(cloud) if cloud is not None else None,
        tensor_source=arrays,
    )


def _read_downloaded_geotiff(content: bytes) -> dict[str, np.ndarray]:
    if zipfile.is_zipfile(io.BytesIO(content)):
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            tif_names = [
                name for name in archive.namelist()
                if name.lower().endswith((".tif", ".tiff"))
            ]
            if not tif_names:
                raise PreprocessingError("Earth Engine download did not include GeoTIFF data")
            content = archive.read(tif_names[0])

    with MemoryFile(content) as memory_file:
        with memory_file.open() as dataset:
            raw = dataset.read().astype(np.float32)

    expected_count = len(SENTINEL_BANDS) + 1
    if raw.shape[0] != expected_count:
        raise PreprocessingError(
            f"Expected {expected_count} downloaded bands, got {raw.shape[0]}"
        )

    band_names = list(SENTINEL_BANDS) + [MASK_BAND]
    return {
        band_name: raw[index]
        for index, band_name in enumerate(band_names)
    }
