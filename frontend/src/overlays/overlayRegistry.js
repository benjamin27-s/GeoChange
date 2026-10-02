export const OVERLAY_LAYERS = Object.freeze({
  roi: "roi",
  detections: "detections",
  forecasts: "forecasts",
  telemetry: "telemetry",
});

export function createOverlayRegistry() {
  const layers = new Map();

  return {
    register(layerName, controller) {
      layers.set(layerName, controller);
    },
    get(layerName) {
      return layers.get(layerName);
    },
    clear() {
      layers.forEach((controller) => controller?.destroy?.());
      layers.clear();
    },
  };
}
