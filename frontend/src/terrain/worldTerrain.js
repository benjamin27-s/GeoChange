import { Terrain } from "cesium";

export function createProductionTerrain() {
  return Terrain.fromWorldTerrain({
    requestVertexNormals: true,
    requestWaterMask: true,
  });
}
