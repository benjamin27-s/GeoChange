import {
  BingMapsStyle,
  Color,
  Ion,
  IonImageryProvider,
  Math as CesiumMath,
  ShadowMode,
  SkyAtmosphere,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

import { getCesiumIonToken } from "../core/environment.js";
import { configureCameraControls, flyToPreset } from "../camera/navigation.js";
import { createProductionTerrain } from "../terrain/worldTerrain.js";

export async function createCesiumViewer(container) {
  const token = getCesiumIonToken();

  if (token) {
    Ion.defaultAccessToken = token;
  }

  const viewer = new Viewer(container, {
    animation: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    navigationHelpButton: false,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    terrain: createProductionTerrain(),
    requestRenderMode: true,
    maximumRenderTimeChange: 0.5,
    contextOptions: {
      webgl: {
        alpha: false,
        antialias: true,
        powerPreference: "high-performance",
      },
    },
  });

  viewer.imageryLayers.removeAll();
  viewer.imageryLayers.addImageryProvider(
    await IonImageryProvider.fromAssetId(2),
  );

  const scene = viewer.scene;
  scene.globe.enableLighting = true;
  scene.globe.dynamicAtmosphereLighting = true;
  scene.globe.dynamicAtmosphereLightingFromSun = true;
  scene.globe.depthTestAgainstTerrain = true;
  scene.globe.showGroundAtmosphere = true;
  scene.globe.maximumScreenSpaceError = 2;
  scene.skyAtmosphere = new SkyAtmosphere();
  scene.skyAtmosphere.hueShift = -0.02;
  scene.skyAtmosphere.saturationShift = 0.12;
  scene.skyAtmosphere.brightnessShift = -0.08;
  scene.backgroundColor = Color.fromCssColorString("#02050b");
  scene.highDynamicRange = true;
  scene.fog.enabled = true;
  scene.fog.density = 0.00018;
  scene.shadowMap.enabled = false;
  scene.globe.shadows = ShadowMode.DISABLED;

  viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 1.5);
  viewer.scene.postProcessStages.fxaa.enabled = true;
  viewer.camera.percentageChanged = 0.03;

  configureCameraControls(viewer);
  flyToPreset(viewer, "orbital");

  viewer.scene.requestRender();

  return viewer;
}

export const IMAGERY_BASELINE = {
  provider: "Cesium ion Bing Maps Aerial",
  style: BingMapsStyle.AERIAL,
  terrain: "Cesium World Terrain",
  initialPitchDegrees: -88,
  maxScreenSpaceError: 2,
  resolutionScaleLimit: 1.5,
  cameraChangeThreshold: CesiumMath.toDegrees(0.03),
};
