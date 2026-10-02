import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

import { useMapAnimation } from "../../hooks/useMapAnimation.js";
import { createRoiAtPoint } from "../../lib/roi.js";
import {
  loadCountries,
  getCountryIso3,
} from "../../services/countries.js";


import "maplibre-gl/dist/maplibre-gl.css";

const STYLE_URL =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const ROI_SOURCE = "auto-roi";
const ROI_FILL = "auto-roi-fill";
const ROI_LINE = "auto-roi-line";
const ROI_GLOW = "auto-roi-glow";
const ROI_ANIMATION_LAYERS = [ROI_FILL, ROI_GLOW];

const COUNTRIES_SOURCE = "countries";
const COUNTRIES_FILL = "countries-fill";
const COUNTRIES_OUTLINE = "countries-outline";

const HOVER_SOURCE = "hover-country";
const HOVER_FILL = "hover-country-fill";
const HOVER_OUTLINE = "hover-country-outline";
const HOVER_GLOW = "hover-country-glow";


function rafThrottle(fn, minIntervalMs = 50) {
  let last = 0;
  let raf = null;
  let lastArgs = null;

  return (...args) => {
    lastArgs = args;
    const now = performance.now();
    if (now - last < minIntervalMs) return;
    if (raf != null) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      last = performance.now();
      fn(...lastArgs);
    });
  };
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toPlainFeature(feature) {
  if (!feature?.geometry) return null;
  return {
    type: "Feature",
    id: feature.id,
    properties: { ...(feature.properties || {}) },
    geometry: JSON.parse(JSON.stringify(feature.geometry)),
  };
}

export default function MapView({
  roi,
  onRoiChange,
  flyTo,
  placeRoiAt,
  roiSizeKm,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const onRoiChangeRef = useRef(onRoiChange);

  useEffect(() => {
    onRoiChangeRef.current = onRoiChange;
  }, [onRoiChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const hoverStateRef = {
      hoveredIso3: null,
      hoverNonce: 0,
      hoverToken: 0,
      lastHoverApplyAt: 0,
    };

    let disposed = false;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [20, 10],
      zoom: 2.2,
      attributionControl: false,
      pitch: 0,
      // Keep interaction feeling high-FPS and premium.
      // requestRenderFrame works with style updates; we still use default map loop.
      // If the runtime environment disables render, MapLibre will still redraw on interaction.
    });

    mapRef.current = map;

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: false }),
      "bottom-left",
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );

    const ensureRoiLayers = () => {
      if (disposed || !map || map._removed || !map.isStyleLoaded()) return;
      map.resize();

      if (!map.getSource(ROI_SOURCE)) {
        map.addSource(ROI_SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      if (!map.getLayer(ROI_GLOW)) {
        map.addLayer({
          id: ROI_GLOW,
          type: "line",
          source: ROI_SOURCE,
          paint: {
            "line-color": "#50e6ff",
            "line-width": 6,
            "line-opacity": 0.15,
            "line-blur": 4,
          },
        });
      }

      if (!map.getLayer(ROI_FILL)) {
        map.addLayer({
          id: ROI_FILL,
          type: "fill",
          source: ROI_SOURCE,
          paint: {
            "fill-color": "#50e6ff",
            "fill-opacity": 0.1,
          },
        });
      }

      if (!map.getLayer(ROI_LINE)) {
        map.addLayer({
          id: ROI_LINE,
          type: "line",
          source: ROI_SOURCE,
          paint: {
            "line-color": "#50e6ff",
            "line-width": 2,
            "line-opacity": 0.85,
          },
        });
      }
    };

    const ensureCountriesAndHoverLayers = () => {
      if (disposed || !map || map._removed || !map.isStyleLoaded()) return;

      // Countries source (GeoJSON)
      if (!map.getSource(COUNTRIES_SOURCE)) {
        // Load once; safe-guard against multiple calls.
        loadCountries()
          .then((features) => {
            if (disposed || !map || map._removed) return;
            const fc = {
              type: "FeatureCollection",
              features: features || [],
            };
            if (!map.getSource(COUNTRIES_SOURCE)) {
              map.addSource(COUNTRIES_SOURCE, {
                type: "geojson",
                data: fc,
              });
            } else {
              map.getSource(COUNTRIES_SOURCE)?.setData(fc);
            }
          })
          .catch(() => {
            // no-op
          });
      }

      if (map.getSource(COUNTRIES_SOURCE)) {
        if (!map.getLayer(COUNTRIES_FILL)) {
          map.addLayer({
            id: COUNTRIES_FILL,
            type: "fill",
            source: COUNTRIES_SOURCE,
            paint: {
              "fill-color": "#0b2a3a",
              "fill-opacity": 0.22,
            },
          });
        }

        if (!map.getLayer(COUNTRIES_OUTLINE)) {
          map.addLayer({
            id: COUNTRIES_OUTLINE,
            type: "line",
            source: COUNTRIES_SOURCE,
            paint: {
              "line-color": "#2db3ff",
              "line-width": 1,
              "line-opacity": 0.18,
            },
          });
        }
      }

      // Hover hit layers
      if (!map.getSource(HOVER_SOURCE)) {
        map.addSource(HOVER_SOURCE, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }

      if (!map.getLayer(HOVER_GLOW)) {
        map.addLayer({
          id: HOVER_GLOW,
          type: "line",
          source: HOVER_SOURCE,
          paint: {
            "line-color": "#77f1ff",
            "line-width": 5,
            "line-opacity": 0.0,
            "line-blur": 6,
          },
        });
      }

      if (!map.getLayer(HOVER_FILL)) {
        map.addLayer({
          id: HOVER_FILL,
          type: "fill",
          source: HOVER_SOURCE,
          paint: {
            "fill-color": "#77f1ff",
            "fill-opacity": 0.0,
          },
        });
      }

      if (!map.getLayer(HOVER_OUTLINE)) {
        map.addLayer({
          id: HOVER_OUTLINE,
          type: "line",
          source: HOVER_SOURCE,
          paint: {
            "line-color": "#b8fbff",
            "line-width": 2,
            "line-opacity": 0.0,
          },
        });
      }

      const applyHoverVisuals = (isHovered) => {
        const fillTarget = isHovered ? 0.28 : 0;
        const outlineTarget = isHovered ? 0.85 : 0;
        const glowTarget = isHovered ? 0.35 : 0;

        const start = performance.now();
        const duration = 220;

        const step = () => {
          if (disposed || !map || map._removed) return;
          const t = clamp((performance.now() - start) / duration, 0, 1);
          const k = easeOutCubic(t);
          try {
            map.setPaintProperty(HOVER_FILL, "fill-opacity", k * fillTarget);
            map.setPaintProperty(
              HOVER_OUTLINE,
              "line-opacity",
              k * outlineTarget,
            );
            map.setPaintProperty(HOVER_GLOW, "line-opacity", k * glowTarget);
          } catch {
            // ignore
          }
          if (t < 1) requestAnimationFrame(step);
        };

        requestAnimationFrame(step);
      };

      // Hover hit-testing (throttled + no per-mousemove source churn)
      const onMove = rafThrottle((e) => {
        if (disposed || !map || map._removed || !map.isStyleLoaded()) return;
        if (!map.getLayer(COUNTRIES_FILL)) return;
        const point = e.point;

        const rendered = map.queryRenderedFeatures(point, {
          layers: [COUNTRIES_FILL],
        });
        const feature = rendered?.[0] || null;
        const iso3 = feature ? getCountryIso3(feature) || feature.id : null;

        if (!feature || !iso3) {
          if (hoverStateRef.hoveredIso3 != null) {
            hoverStateRef.hoveredIso3 = null;
            hoverStateRef.hoverNonce++;
            applyHoverVisuals(false);
            // Clear hover polygon once on exit (not every mousemove)
            map.getSource(HOVER_SOURCE)?.setData({
              type: "FeatureCollection",
              features: [],
            });
          }
          return;
        }

        if (iso3 === hoverStateRef.hoveredIso3) return;

        hoverStateRef.hoveredIso3 = iso3;
        hoverStateRef.hoverNonce++;

        // Update hover polygon only when country changes.
        const hoverFeature = toPlainFeature(feature);
        if (!hoverFeature) return;
        map.getSource(HOVER_SOURCE)?.setData({
          type: "FeatureCollection",
          features: [hoverFeature],
        });
        applyHoverVisuals(true);
      }, 50);


      map.on("mousemove", onMove);
      map.on("mouseleave", () => {
        if (disposed || !map || map._removed) return;
        hoverStateRef.hoveredIso3 = null;
        hoverStateRef.hoverNonce++;
        map.getSource(HOVER_SOURCE)?.setData({
          type: "FeatureCollection",
          features: [],
        });
        applyHoverVisuals(false);
      });
    };

    const handleClick = (event) => {
      const nextRoi = createRoiAtPoint(
        event.lngLat.lat,
        event.lngLat.lng,
        roiSizeKm,
      );
      onRoiChangeRef.current(nextRoi);
    };

    map.dragPan.enable();
    map.scrollZoom.enable();

    map.on("load", () => {
      ensureRoiLayers();
      ensureCountriesAndHoverLayers();
    });
    map.on("styledata", () => {
      ensureRoiLayers();
      ensureCountriesAndHoverLayers();
    });

    map.on("click", handleClick);

    return () => {
      disposed = true;
      if (mapRef.current) {
        map.off("click", handleClick);
        map.remove();
      }
      mapRef.current = null;
    };
  }, [roiSizeKm]);

  // Apply ROI geometry
  useEffect(() => {
    const map = mapRef.current;
    if (!map || map._removed) return;

    let cancelled = false;

    const applyRoi = () => {
      if (cancelled || map._removed || !map.isStyleLoaded()) return;
      const source = map.getSource(ROI_SOURCE);
      if (!source || typeof source.setData !== "function") return;
      const features = roi?.geojson ? [roi.geojson] : [];
      source.setData({
        type: "FeatureCollection",
        features,
      });
    };

    if (map.isStyleLoaded()) applyRoi();
    else map.once("load", applyRoi);

    return () => {
      cancelled = true;
      try {
        map.off("load", applyRoi);
      } catch {
        // ignore
      }
    };
  }, [roi]);

  useEffect(() => {
    const map = mapRef.current;
    if (!flyTo || !map || map._removed) return;

    map.easeTo({
      center: [flyTo.longitude, flyTo.latitude],
      zoom: flyTo.zoom ?? 11.5,
      duration: 1100,
      easing: (t) => easeOutCubic(t),
    });
  }, [flyTo]);

  useEffect(() => {
    const map = mapRef.current;
    if (!placeRoiAt?.key || !map || map._removed) return;

    const nextRoi = createRoiAtPoint(
      placeRoiAt.latitude,
      placeRoiAt.longitude,
      roiSizeKm,
    );
    onRoiChangeRef.current(nextRoi);

    map.easeTo({
      center: [placeRoiAt.longitude, placeRoiAt.latitude],
      zoom: placeRoiAt.zoom ?? 11.5,
      duration: 1100,
      easing: (t) => easeOutCubic(t),
    });
  }, [placeRoiAt?.key, roiSizeKm, placeRoiAt]);

  useMapAnimation(mapRef, ROI_ANIMATION_LAYERS);

  return <div ref={containerRef} className="map-canvas" />;
}

