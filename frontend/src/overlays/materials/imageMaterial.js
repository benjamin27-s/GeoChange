import {
  Color,
  ImageMaterialProperty,
} from "cesium";

export function createImageOverlayMaterial(image, opacity = 0.7) {
  return new ImageMaterialProperty({
    image,
    transparent: true,
    color: Color.WHITE.withAlpha(opacity),
  });
}
