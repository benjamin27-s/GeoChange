import { useEffect, useRef, useState } from "react";

import { installDoubleClickFlyTo } from "../camera/navigation.js";
import { createCesiumViewer } from "../cesium/createCesiumViewer.js";
import { installRoiInteractionController } from "../interactions/roiInteractionController.js";
import { resetInteractionState } from "../state/interactionStore.js";

export function useCesiumViewer(containerRef) {
  const viewerRef = useRef(null);
  const cleanupRefs = useRef([]);
  const [status, setStatus] = useState("booting");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function bootViewer() {
      if (!containerRef.current || viewerRef.current) {
        return;
      }

      try {
        const viewer = await createCesiumViewer(containerRef.current);

        if (cancelled) {
          viewer.destroy();
          return;
        }

        viewerRef.current = viewer;
        cleanupRefs.current = [
          installDoubleClickFlyTo(viewer),
          installRoiInteractionController(viewer),
        ];
        setStatus("online");
      } catch (viewerError) {
        setError(viewerError.message || "Unable to initialize Cesium viewer");
        setStatus("error");
      }
    }

    bootViewer();

    return () => {
      cancelled = true;

      cleanupRefs.current.forEach((cleanup) => cleanup?.());
      cleanupRefs.current = [];

      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }

      viewerRef.current = null;
      resetInteractionState();
    };
  }, [containerRef]);

  return {
    viewerRef,
    status,
    error,
  };
}
