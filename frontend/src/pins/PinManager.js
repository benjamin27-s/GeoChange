import {
  Cartesian3,
  Cartesian2,
  CallbackProperty,
  Color,
  HeightReference,
  NearFarScalar,
  VerticalOrigin,
} from "cesium";

export class PinManager {
  constructor(viewer) {
    this.viewer = viewer;
    this.activePin = null;
    this.activeFootprint = null;
  }

  setActivePin({ roi, position, createFootprint }) {
    this.clear();

    const createdAt = performance.now();

    const pulseSize = new CallbackProperty(() => {
      const age = Math.min((performance.now() - createdAt) / 900, 1);
      return 14 + Math.sin(age * Math.PI) * 10;
    }, false);

    this.activePin = this.viewer.entities.add({
      id: `${roi.id}-pin`,
      name: "Selected AI ROI",
      position,
      point: {
        pixelSize: 11,
        color: Color.fromCssColorString("#ff405f"),
        outlineColor: Color.WHITE.withAlpha(0.95),
        outlineWidth: 2,
        heightReference: HeightReference.CLAMP_TO_GROUND,
        scaleByDistance: new NearFarScalar(1000, 1.2, 6500000, 0.62),
        disableDepthTestDistance: 3500000,
      },
      ellipse: {
        semiMajorAxis: 180,
        semiMinorAxis: 180,
        material: Color.fromCssColorString("#ff405f").withAlpha(0.16),
        outline: true,
        outlineColor: Color.fromCssColorString("#ff9aad").withAlpha(0.55),
        heightReference: HeightReference.CLAMP_TO_GROUND,
      },
      billboard: undefined,
      label: {
        text: "ROI",
        font: "12px Inter, sans-serif",
        fillColor: Color.WHITE,
        outlineColor: Color.BLACK.withAlpha(0.55),
        outlineWidth: 2,
        pixelOffset: new Cartesian2(0, -24),
        verticalOrigin: VerticalOrigin.BOTTOM,
        scaleByDistance: new NearFarScalar(1000, 1, 6500000, 0.4),
        disableDepthTestDistance: 3500000,
      },
      properties: {
        roiId: roi.id,
        type: "active-roi-pin",
        centerLatitude: roi.center.latitude,
        centerLongitude: roi.center.longitude,
      },
    });

    this.activePin.point.pixelSize = pulseSize;

    if (createFootprint) {
      this.activeFootprint = createFootprint(this.viewer, roi);
    }

    this.requestAnimationFrames(900);

    return this.activePin;
  }

  clear() {
    if (this.activePin) {
      this.viewer.entities.remove(this.activePin);
      this.activePin = null;
    }

    if (this.activeFootprint) {
      this.viewer.entities.remove(this.activeFootprint);
      this.activeFootprint = null;
    }
  }

  destroy() {
    this.clear();
  }

  requestAnimationFrames(durationMs) {
    const start = performance.now();
    const tick = () => {
      if (this.viewer.isDestroyed()) {
        return;
      }

      this.viewer.scene.requestRender();

      if (performance.now() - start < durationMs) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }
}
