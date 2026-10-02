function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function createDetectPayload(roi) {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 7);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 30);

  return {
    latitude: roi.center.latitude,
    longitude: roi.center.longitude,
    roi_size_km: roi.dimensions.widthKm,
    start_date: toIsoDate(start),
    end_date: toIsoDate(end),
  };
}

export function createForecastPayload(roi) {
  return {
    latitude: roi.center.latitude,
    longitude: roi.center.longitude,
    roi_size_km: roi.dimensions.widthKm,
  };
}
