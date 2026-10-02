/*
  Hover flag texture renderer for MapLibre.

  This module renders a national flag image into an offscreen canvas, then clips it
  to a provided polygon ring list.

  NOTE:
  - MapLibre does not provide polygon clipping for raster layers directly.
  - To avoid per-frame heavy clipping, we only regenerate the flag texture when
    the hovered country changes.

  Inputs:
  - canvas size (px)
  - polygon coordinates in lon/lat
  - flag image (HTMLImageElement)

  Output:
  - { canvas, dataUrl } where dataUrl is a PNG data URI suitable for MapLibre image source.
*/

export function getCanvasPointFromLonLat(lon, lat, bounds, width, height) {
  const x = ((lon - bounds.west) / (bounds.east - bounds.west)) * width;
  const y = (1 - (lat - bounds.south) / (bounds.north - bounds.south)) * height;
  return [x, y];
}

function safeBounds(bounds) {
  const minSpan = 1e-6;
  const west = bounds.west;
  const east = bounds.east;
  const south = bounds.south;
  const north = bounds.north;

  return {
    west,
    east: Math.abs(east - west) < minSpan ? east + minSpan : east,
    south,
    north: Math.abs(north - south) < minSpan ? north + minSpan : north,
  };
}

/**
 * Draw a flag image clipped to a polygon.
 * @param {object} opts
 * @param {number} opts.width
 * @param {number} opts.height
 * @param {HTMLImageElement} opts.flagImg
 * @param {Array} opts.coordinates - GeoJSON Polygon/MultiPolygon coordinates
 * @param {object} opts.bounds - {west, south, east, north}
 */
export function renderFlagToCanvasClippedToPolygon({
  width,
  height,
  flagImg,
  coordinates,
  bounds,
}) {
  const safe = safeBounds(bounds);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return { canvas, dataUrl: null };

  // Base: flag as a cover crop.
  // We'll fit to bounds aspect ratio and center-crop to reduce distortion.
  const imgW = flagImg.naturalWidth || flagImg.width;
  const imgH = flagImg.naturalHeight || flagImg.height;
  const imgAspect = imgW / imgH;
  const canvasAspect = width / height;

  let drawW = width;
  let drawH = height;
  if (imgAspect > canvasAspect) {
    // image wider than canvas
    drawH = height;
    drawW = drawH * imgAspect;
  } else {
    // image taller
    drawW = width;
    drawH = drawW / imgAspect;
  }

  const dx = (width - drawW) / 2;
  const dy = (height - drawH) / 2;

  ctx.clearRect(0, 0, width, height);

  // Clip path: use non-zero winding; fill all polygon rings.
  // GeoJSON: for Polygon coordinates = [ [ring1], [ring2], ... ]
  // For MultiPolygon coordinates = [ polygon1, polygon2, ... ]
  // We'll flatten into multiple rings.
  ctx.save();

  const addPolygonRings = (poly) => {
    // poly is an array of rings
    for (const ring of poly) {
      if (!Array.isArray(ring) || ring.length < 3) continue;
      ctx.beginPath();
      for (let i = 0; i < ring.length; i++) {
        const [lon, lat] = ring[i];
        const [x, y] = getCanvasPointFromLonLat(lon, lat, safe, width, height);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      // fill will be applied after drawing all rings
    }
  };

  // Detect polygon vs multipolygon
  if (Array.isArray(coordinates?.[0]?.[0]?.[0])) {
    // MultiPolygon: coordinates = [ poly1, poly2, ... ]
    for (const poly of coordinates) addPolygonRings(poly);
  } else {
    // Polygon: coordinates = [ ring1, ring2, ... ]
    addPolygonRings(coordinates);
  }

  ctx.clip();

  // Draw flag underneath clipping mask
  ctx.globalAlpha = 1;
  ctx.drawImage(flagImg, dx, dy, drawW, drawH);

  // Optional: add slight inner brightness to feel premium
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.restore();

  const dataUrl = canvas.toDataURL("image/png");
  return { canvas, dataUrl };
}

