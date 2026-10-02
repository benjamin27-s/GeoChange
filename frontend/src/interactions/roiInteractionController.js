import {
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from "cesium";

import { flyToRoiFocus } from "../camera/focusCamera.js";
import { createRoiRectangleEntity } from "../entities/roiEntity.js";
import { PinManager } from "../pins/PinManager.js";
import { pickGlobeLocation } from "../picking/globePicking.js";
import { createRoiSelection, DEFAULT_ROI_SIZE_KM } from "../roi/roiMath.js";
import { setActiveRoi } from "../state/interactionStore.js";

export function installRoiInteractionController(viewer, options = {}) {
  const pinManager = new PinManager(viewer);
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  const roiSizeKm = options.roiSizeKm || DEFAULT_ROI_SIZE_KM;

  handler.setInputAction((movement) => {
    const picked = pickGlobeLocation(viewer, movement.position);

    if (!picked) {
      return;
    }

    const roi = createRoiSelection({
      latitude: picked.latitude,
      longitude: picked.longitude,
      altitude: picked.altitude,
      roiSizeKm,
    });

    const pin = pinManager.setActivePin({
      roi,
      position: picked.cartesian,
      createFootprint: createRoiRectangleEntity,
    });

    setActiveRoi({
      roi,
      entityId: pin.id,
    });

    flyToRoiFocus(viewer, roi);
    viewer.scene.requestRender();
  }, ScreenSpaceEventType.LEFT_CLICK);

  return () => {
    handler.destroy();
    pinManager.destroy();
  };
}
