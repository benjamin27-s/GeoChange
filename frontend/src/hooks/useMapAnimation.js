/* @refresh reset */
// ROI layer pulse animation. Registers its effect last when called after MapView effects.

import { useEffect, useRef } from "react";

export function useMapAnimation(mapRef, layerIds = []) {
  const pulseRef = useRef(0);
  const fillLayerId = layerIds[0] ?? null;
  const glowLayerId = layerIds[1] ?? null;
  const layerKey = `${fillLayerId ?? ""}|${glowLayerId ?? ""}`;

  useEffect(() => {
    let frameId = null;
    let stopped = false;
    let detachRemoveListener = null;
    let detachInteractionListener = null;
    let pausedByInteraction = false;
    let lastWriteTs = 0;
    const MIN_WRITE_INTERVAL_MS = 80; // ~12.5 writes/sec; reduces paint churn

    const stop = () => {
      stopped = true;
      if (frameId != null) {
        cancelAnimationFrame(frameId);
        frameId = null;
      }
    };

    const isMapUsable = (map) =>
      map &&
      !map._removed &&
      typeof map.isStyleLoaded === "function" &&
      map.isStyleLoaded() &&
      typeof map.getLayer === "function" &&
      typeof map.setPaintProperty === "function";

    const scheduleFrame = () => {
      if (!stopped) {
        frameId = requestAnimationFrame(animate);
      }
    };

    const animate = () => {
      if (stopped) return;

      frameId = null;
      const map = mapRef.current;

      if (!isMapUsable(map)) {
        scheduleFrame();
        return;
      }

      const now = performance.now();
      if (!pausedByInteraction && now - lastWriteTs >= MIN_WRITE_INTERVAL_MS) {
        lastWriteTs = now;
      } else {
        scheduleFrame();
        return;
      }

      pulseRef.current += 0.04;
      const opacity = 0.08 + Math.sin(pulseRef.current) * 0.06;

      try {
        if (fillLayerId && map.getLayer(fillLayerId)) {
          map.setPaintProperty(fillLayerId, "fill-opacity", opacity);
        }

        if (glowLayerId && map.getLayer(glowLayerId)) {
          map.setPaintProperty(glowLayerId, "line-opacity", 0.12 + opacity);
        }
      } catch {
        // MapLibre can reject style writes during load/removal.
      }

      scheduleFrame();
    };

    const bindMapRemove = () => {
      const map = mapRef.current;
      if (!map || map._removed || typeof map.once !== "function") return;

      const onRemove = () => stop();
      map.once("remove", onRemove);
      detachRemoveListener = () => {
        if (!map._removed && typeof map.off === "function") {
          map.off("remove", onRemove);
        }
      };
    };

    bindMapRemove();

    // Pause pulse animation during user interaction for a smoother pan/zoom feel.
    // MapLibre emits multiple interaction-like events; covering the most common ones.
    const bindInteractionPauses = () => {
      const map = mapRef.current;
      if (!map || map._removed || typeof map.on !== "function") return;
      const onStart = () => {
        pausedByInteraction = true;
      };
      const onEnd = () => {
        pausedByInteraction = false;
      };
      map.on("movestart", onStart);
      map.on("zoomstart", onStart);
      map.on("rotatestart", onStart);
      map.on("moveend", onEnd);
      map.on("zoomend", onEnd);
      map.on("rotateend", onEnd);

      detachInteractionListener = () => {
        try {
          map.off("movestart", onStart);
          map.off("zoomstart", onStart);
          map.off("rotatestart", onStart);
          map.off("moveend", onEnd);
          map.off("zoomend", onEnd);
          map.off("rotateend", onEnd);
        } catch {
          // no-op
        }
      };
    };

    bindInteractionPauses();
    scheduleFrame();

    return () => {
      stop();
      detachRemoveListener?.();
      detachInteractionListener?.();
      detachRemoveListener = null;
      detachInteractionListener = null;
    };
  }, [mapRef, layerKey, fillLayerId, glowLayerId]);
}
