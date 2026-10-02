const EARTH_KM_PER_LAT_DEGREE = 111.32;
const DEFAULT_ROI_SIZE_KM = 10;

export function createBoundingBoxFromCenter(latitude, longitude, roiSizeKm = DEFAULT_ROI_SIZE_KM) {
  const halfSizeKm = roiSizeKm / 2;
  const latitudeDelta = halfSizeKm / EARTH_KM_PER_LAT_DEGREE;
  const longitudeScale =
    EARTH_KM_PER_LAT_DEGREE * Math.cos((latitude * Math.PI) / 180);

  const longitudeDelta =
    Math.abs(longitudeScale) < 1e-6 ? 180 : halfSizeKm / longitudeScale;

  return {
    west: clampLongitude(longitude - longitudeDelta),
    south: clampLatitude(latitude - latitudeDelta),
    east: clampLongitude(longitude + longitudeDelta),
    north: clampLatitude(latitude + latitudeDelta),
  };
}

export function createRoiSelection({
  latitude,
  longitude,
  altitude = 0,
  roiSizeKm = DEFAULT_ROI_SIZE_KM,
  timestamp = new Date().toISOString(),
}) {
  return {
    id: `roi-${Date.now()}`,
    center: {
      latitude,
      longitude,
      altitude,
    },
    bbox: createBoundingBoxFromCenter(latitude, longitude, roiSizeKm),
    dimensions: {
      widthKm: roiSizeKm,
      heightKm: roiSizeKm,
    },
    timestamp,
  };
}

function clampLatitude(latitude) {
  return Math.max(-90, Math.min(90, latitude));
}

function clampLongitude(longitude) {
  if (longitude < -180) {
    return longitude + 360;
  }

  if (longitude > 180) {
    return longitude - 360;
  }

  return longitude;
}

export { DEFAULT_ROI_SIZE_KM };
