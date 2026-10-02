import {
  Cartesian3,
  Math as CesiumMath,
} from "cesium";

export function flyToRoiFocus(viewer, roi) {
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(
      roi.center.longitude,
      roi.center.latitude,
      180000,
    ),
    orientation: {
      heading: viewer.camera.heading,
      pitch: CesiumMath.toRadians(-68),
      roll: 0,
    },
    duration: 1.35,
    maximumHeight: 900000,
  });
}
