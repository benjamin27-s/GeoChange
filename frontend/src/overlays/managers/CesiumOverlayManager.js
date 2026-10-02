import {
  Color,
  HeightReference,
  Rectangle,
} from "cesium";

import { createImageOverlayMaterial } from "../materials/imageMaterial.js";
import {
  clearOverlayState,
  setOverlayLayers,
  updateOverlayLayer,
} from "../layers/overlayStore.js";

export class CesiumOverlayManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.entities = new Map();
  }

  renderInferenceResult({ workflow, roi, response }) {
    const layers = buildLayerDefinitions(workflow, roi, response);

    // Upsert entities to avoid re-creating textures/materials on every run.
    // This stabilizes FPS and reduces potential memory churn.
    const nextIds = new Set(layers.map((l) => l.id));

    // Remove entities that are no longer present.
    this.entities.forEach(({ entity }, id) => {
      if (!nextIds.has(id)) {
        this.viewer.entities.remove(entity);
        this.entities.delete(id);
      }
    });

    layers.forEach((layer) => {
      const existing = this.entities.get(layer.id);

      const rectangleDef = {
        coordinates: Rectangle.fromDegrees(
          layer.bounds.west,
          layer.bounds.south,
          layer.bounds.east,
          layer.bounds.north,
        ),
        material: createImageOverlayMaterial(layer.image, layer.opacity),
        outline: true,
        outlineColor: Color.fromCssColorString(layer.outlineColor).withAlpha(0.78),
        heightReference: HeightReference.CLAMP_TO_GROUND,
      };

      if (existing?.entity) {
        existing.entity.name = layer.label;
        existing.entity.rectangle = rectangleDef;
        existing.layer = layer;
      } else {
        const entity = this.viewer.entities.add({
          id: layer.id,
          name: layer.label,
          rectangle: rectangleDef,
          properties: {
            workflow,
            layerType: layer.type,
            roiId: roi.id,
          },
        });

        this.entities.set(layer.id, {
          entity,
          layer,
        });
      }
    });

    setOverlayLayers(layers, {
      workflow,
      response,
      roi,
    });
    this.viewer.scene.requestRender();
  }

  setLayerVisible(layerId, visible) {
    const record = this.entities.get(layerId);
    if (!record) {
      return;
    }

    record.entity.show = visible;
    record.layer.visible = visible;
    updateOverlayLayer(layerId, { visible });
    this.viewer.scene.requestRender();
  }

  setLayerOpacity(layerId, opacity) {
    const record = this.entities.get(layerId);
    if (!record) {
      return;
    }

    record.entity.rectangle.material = createImageOverlayMaterial(
      record.layer.image,
      opacity,
    );
    record.layer.opacity = opacity;
    updateOverlayLayer(layerId, { opacity });
    this.viewer.scene.requestRender();
  }

  clear() {
    this.entities.forEach(({ entity }) => {
      this.viewer.entities.remove(entity);
    });
    this.entities.clear();
    clearOverlayState();
    this.viewer?.scene?.requestRender?.();
  }

  destroy() {
    this.clear();
  }
}

function buildLayerDefinitions(workflow, roi, response) {
  const bounds = normalizeBounds(response.roi, roi.bbox);
  const layers = [];

  if (workflow === "detect") {
    const overlays = response.inference?.statistics?.overlays || {};

    if (overlays.heatmap?.data_url) {
      layers.push(makeLayer({
        workflow,
        type: "detection-heatmap",
        label: "Confidence Heatmap",
        image: overlays.heatmap.data_url,
        opacity: overlays.heatmap.opacity ?? 0.62,
        bounds,
        outlineColor: "#50e6ff",
      }));
    }

    if (overlays.binary_mask?.data_url) {
      layers.push(makeLayer({
        workflow,
        type: "change-mask",
        label: "Binary Change Mask",
        image: overlays.binary_mask.data_url,
        opacity: overlays.binary_mask.opacity ?? 0.74,
        bounds,
        outlineColor: "#ff405f",
      }));
    }
  }

  if (workflow === "forecast") {
    const preview = response.inference?.statistics?.rgb_preview;

    if (preview?.data_url) {
      layers.push(makeLayer({
        workflow,
        type: "forecast-rgb",
        label: "Predicted T4 RGB",
        image: preview.data_url,
        opacity: preview.opacity ?? 0.78,
        bounds,
        outlineColor: "#7dfacb",
      }));
    }
  }

  return layers;
}

function makeLayer({ workflow, type, label, image, opacity, bounds, outlineColor }) {
  return {
    // Deterministic IDs allow us to "upsert" entities instead of re-creating them.
    id: `${workflow}-${type}`,
    workflow,
    type,
    label,
    image,
    opacity,
    visible: true,
    bounds,
    outlineColor,
  };
}

function normalizeBounds(responseRoi, frontendBbox) {
  if (responseRoi?.min_longitude !== undefined) {
    return {
      west: responseRoi.min_longitude,
      south: responseRoi.min_latitude,
      east: responseRoi.max_longitude,
      north: responseRoi.max_latitude,
    };
  }

  return frontendBbox;
}
