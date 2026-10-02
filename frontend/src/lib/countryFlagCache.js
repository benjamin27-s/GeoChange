// Country flag rendering support for MapLibre.
//
// Strategy:
// - Map ISO3166-1 alpha-3 -> alpha-2 if possible (via CDN directory naming).
// - Use a deterministic public flag CDN that doesn't require extra npm dependencies.
// - Cache loaded HTMLImageElement instances to avoid re-decoding on hover.
//
// NOTE:
// - If your environment blocks external images, swap FLAG_BASE_URL to a local asset folder.

const FLAG_BASE_URL =
  // https://flagcdn.com/ directory format: {xx}.png
  // Example: https://flagcdn.com/us.png
  "https://flagcdn.com/";

// Cache HTMLImageElement by ISO alpha-2 (best-effort).
const imageCache = new Map();

function normalizeIso2(iso2) {
  return (iso2 || "").toLowerCase().trim();
}

function normalizeIso3(iso3) {
  return (iso3 || "").toUpperCase().trim();
}

// Best-effort ISO3->ISO2 mapping.
// This project already loads country metadata from RestCountries (cca2/cca3). We don't have it here,
// so we provide a small fallback mapping only for common cases.
// In practice, we'll try ISO3->ISO2 using a lightweight heuristic: lookup by first two letters is NOT reliable,
// so we prefer ISO2 from the feature properties when available.
const COMMON_ISO3_TO_ISO2 = new Map([
  ["USA", "US"],
  ["IND", "IN"],
  ["GBR", "GB"],
  ["DEU", "DE"],
  ["FRA", "FR"],
  ["JPN", "JP"],
  ["CHN", "CN"],
  ["BRA", "BR"],
  ["CAN", "CA"],
  ["AUS", "AU"],
  ["ESP", "ES"],
  ["ITA", "IT"],
  ["RUS", "RU"],
  ["MEX", "MX"],
  ["KOR", "KR"],
  ["IDN", "ID"],
  ["TUR", "TR"],
  ["SAU", "SA"],
  ["ZAF", "ZA"],
  ["EGY", "EG"],
  ["NGA", "NG"],
]);

export function getFlagUrlFromIso2(iso2) {
  const normalized = normalizeIso2(iso2);
  if (!normalized) return null;
  return `${FLAG_BASE_URL}${normalized}.png`;
}

export function getFlagUrlFromIso3(iso3) {
  const normalized = normalizeIso3(iso3);
  if (!normalized) return null;
  const iso2 = COMMON_ISO3_TO_ISO2.get(normalized);
  if (!iso2) return null;
  return getFlagUrlFromIso2(iso2);
}

export async function loadFlagImage({ iso2, iso3, crossOrigin = "anonymous" } = {}) {
  const url =
    getFlagUrlFromIso2(iso2) || getFlagUrlFromIso3(iso3);

  if (!url) return null;

  const key = normalizeIso2(iso2) || normalizeIso3(iso3);
  if (imageCache.has(key)) return imageCache.get(key);

  const img = new Image();
  img.crossOrigin = crossOrigin;

  const loaded = await new Promise((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });

  if (!loaded) return null;
  imageCache.set(key, img);
  return img;
}

