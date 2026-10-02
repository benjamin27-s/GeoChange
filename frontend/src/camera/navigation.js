import {
  CameraEventType,
  Cartesian3,
  defined,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from "cesium";

import { CAMERA_PRESETS } from "./cameraPresets.js";

export function configureCameraControls(viewer) {
  const controller = viewer.scene.screenSpaceCameraController;

  controller.enableCollisionDetection = true;
  controller.enableLook = true;
  controller.enableRotate = true;
  controller.enableTilt = true;
  controller.enableTranslate = true;
  controller.enableZoom = true;
  controller.inertiaSpin = 0.86;
  controller.inertiaTranslate = 0.82;
  controller.inertiaZoom = 0.74;
  controller.minimumZoomDistance = 120;
  controller.maximumZoomDistance = 30000000;
  controller.zoomEventTypes = [
    CameraEventType.WHEEL,
    CameraEventType.PINCH,
    CameraEventType.RIGHT_DRAG,
  ];
}

export function flyToPreset(viewer, presetName = "orbital") {
  const preset = CAMERA_PRESETS[presetName] || CAMERA_PRESETS.orbital;
  viewer.camera.flyTo(preset);
}

export function installDoubleClickFlyTo(viewer) {
  viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
    ScreenSpaceEventType.LEFT_DOUBLE_CLICK,
  );

  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction((movement) => {
    const ellipsoid = viewer.scene.globe.ellipsoid;
    const picked = viewer.camera.pickEllipsoid(movement.position, ellipsoid);

    if (!defined(picked)) {
      return;
    }

    const cartographic = ellipsoid.cartesianToCartographic(picked);
    const longitude = CesiumMath.toDegrees(cartographic.longitude);
    const latitude = CesiumMath.toDegrees(cartographic.latitude);

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(longitude, latitude, 220000),
      orientation: {
        heading: viewer.camera.heading,
        pitch: CesiumMath.toRadians(-72),
        roll: 0,
      },
      duration: 1.45,
    });
  }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

  return () => handler.destroy();
}
