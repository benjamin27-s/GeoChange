import { lazy, Suspense, useCallback, useState } from "react";

import CameraControls from "../controls/CameraControls.jsx";
import MissionHud from "../panels/MissionHud.jsx";
import OverlayControlPanel from "../panels/OverlayControlPanel.jsx";
import StatusPanel from "../panels/StatusPanel.jsx";
import WorkflowStatusHud from "../panels/WorkflowStatusHud.jsx";
import RoiActionPopup from "../popup/RoiActionPopup.jsx";
import { useInferenceWorkflow } from "../workflows/useInferenceWorkflow.js";

const CesiumGlobe = lazy(() => import("../viewer/CesiumGlobe.jsx"));

export default function AppShell() {
  const [viewer, setViewer] = useState(null);
  const [viewerStatus, setViewerStatus] = useState("booting");
  const { runDetect, runForecast, overlayManagerRef } = useInferenceWorkflow(viewer);

  const handleViewerReady = useCallback((nextViewer) => {
    setViewer((currentViewer) =>
      currentViewer && !currentViewer.isDestroyed?.() ? currentViewer : nextViewer,
    );
    setViewerStatus("online");
  }, []);

  return (
    <main className="app-shell">
      <Suspense
        fallback={
          <div className="viewer-status">
            <span className="status-pulse" />
            <span>Loading Cesium runtime</span>
          </div>
        }
      >
        <CesiumGlobe onViewerReady={handleViewerReady} />
      </Suspense>

      <div className="scanline" />
      <MissionHud />
      <StatusPanel status={viewerStatus} />
      <WorkflowStatusHud />
      <OverlayControlPanel overlayManagerRef={overlayManagerRef} />
      <RoiActionPopup onDetect={runDetect} onForecast={runForecast} />
      <CameraControls viewer={viewer} />
    </main>
  );
}
