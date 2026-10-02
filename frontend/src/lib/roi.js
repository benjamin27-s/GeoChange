const EARTH_KM_PER_LAT = 111.32;

/** ~1 km square analysis window (512 m – 1 km spec). */
export const DEFAULT_ROI_SIZE_KM = 1.0;

export function bboxFromCenter(latitude, longitude, roiSizeKm = DEFAULT_ROI_SIZE_KM) {
  const half = roiSizeKm / 2;
  const latDelta = half / EARTH_KM_PER_LAT;
  const lngScale = EARTH_KM_PER_LAT * Math.cos((latitude * Math.PI) / 180);
  const lngDelta = half / Math.abs(lngScale || EARTH_KM_PER_LAT);

  return {
    west: longitude - lngDelta,
    south: latitude - latDelta,
    east: longitude + lngDelta,
    north: latitude + latDelta,
  };
}

export function createRoiAtPoint(latitude, longitude, roiSizeKm = DEFAULT_ROI_SIZE_KM) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const bbox = bboxFromCenter(lat, lng, roiSizeKm);
  const geojson = bboxToSquareFeature(bbox);

  return {
    id: `roi-${Date.now()}`,
    center: { latitude: lat, longitude: lng },
    bbox,
    roiSizeKm,
    areaKm2: roiSizeKm * roiSizeKm,
    geojson,
  };
}

export function bboxToSquareFeature(bbox) {
  const { west, south, east, north } = bbox;
  return {
    type: "Feature",
    properties: { kind: "auto-roi" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
    },
  };
}

