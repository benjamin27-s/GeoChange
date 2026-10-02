import {
  Cartographic,
  defined,
  Math as CesiumMath,
} from "cesium";

export function pickGlobeLocation(viewer, windowPosition) {
  const scene = viewer.scene;
  const ellipsoid = scene.globe.ellipsoid;
  let cartesian;

  if (scene.pickPositionSupported) {
    cartesian = scene.pickPosition(windowPosition);
  }

  if (!defined(cartesian)) {
    const ray = viewer.camera.getPickRay(windowPosition);
    cartesian = scene.globe.pick(ray, scene);
  }

  if (!defined(cartesian)) {
    cartesian = viewer.camera.pickEllipsoid(windowPosition, ellipsoid);
  }

  if (!defined(cartesian)) {
    return null;
  }

  const cartographic = Cartographic.fromCartesian(cartesian, ellipsoid);

  return {
    cartesian,
    cartographic,
    latitude: CesiumMath.toDegrees(cartographic.latitude),
    longitude: CesiumMath.toDegrees(cartographic.longitude),
    altitude: Math.max(cartographic.height || 0, 0),
  };
}
