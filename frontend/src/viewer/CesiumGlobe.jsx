import { memo, useEffect, useRef } from "react";

import { useCesiumViewer } from "./useCesiumViewer.js";

function CesiumGlobe({ onViewerReady }) {
  const containerRef = useRef(null);
  const { viewerRef, status, error } = useCesiumViewer(containerRef);

  useEffect(() => {
    if (status === "online" && viewerRef.current && onViewerReady) {
      onViewerReady(viewerRef.current);
    }
  }, [onViewerReady, status, viewerRef]);

  return (
    <section className="globe-stage" aria-label="Cesium planetary viewer">
      <div ref={containerRef} className="cesium-root" />

      {status !== "online" && (
        <div className="viewer-status">
          <span className="status-pulse" />
          <span>{status === "error" ? error : "Initializing planetary renderer"}</span>
        </div>
      )}
    </section>
  );
}

export default memo(CesiumGlobe);
