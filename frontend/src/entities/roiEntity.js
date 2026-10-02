import {
  Color,
  HeightReference,
  Rectangle,
} from "cesium";

export function createRoiRectangleEntity(viewer, roi) {
  return viewer.entities.add({
    id: `${roi.id}-footprint`,
    name: "Active ROI Footprint",
    rectangle: {
      coordinates: Rectangle.fromDegrees(
        roi.bbox.west,
        roi.bbox.south,
        roi.bbox.east,
        roi.bbox.north,
      ),
      material: Color.fromCssColorString("#50e6ff").withAlpha(0.08),
      outline: true,
      outlineColor: Color.fromCssColorString("#7dfacb").withAlpha(0.72),
      heightReference: HeightReference.CLAMP_TO_GROUND,
      classificationType: undefined,
    },
    properties: {
      roiId: roi.id,
      type: "roi-footprint",
    },
  });
}
