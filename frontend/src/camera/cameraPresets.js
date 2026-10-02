import { Cartesian3, Math as CesiumMath } from "cesium";

export const CAMERA_PRESETS = {
  orbital: {
    destination: Cartesian3.fromDegrees(78.9629, 20.5937, 18500000),
    orientation: {
      heading: CesiumMath.toRadians(0),
      pitch: CesiumMath.toRadians(-88),
      roll: 0,
    },
    duration: 2.4,
  },
  tacticalIndia: {
    destination: Cartesian3.fromDegrees(78.9629, 20.5937, 4500000),
    orientation: {
      heading: CesiumMath.toRadians(0),
      pitch: CesiumMath.toRadians(-62),
      roll: 0,
    },
    duration: 2.0,
  },
};
