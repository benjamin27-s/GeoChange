import { useCallback, useEffect, useRef } from "react";

import {
  runDetectInference,
  runForecastInference,
} from "../api/inferenceApi.js";
import { CesiumOverlayManager } from "../overlays/managers/CesiumOverlayManager.js";
import {
  setWorkflowError,
  setWorkflowLoading,
  setWorkflowResult,
} from "./workflowStore.js";
import {
  createDetectPayload,
  createForecastPayload,
} from "./workflowPayloads.js";

export function useInferenceWorkflow(viewer) {
  const overlayManagerRef = useRef(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed?.()) {
      return undefined;
    }

    overlayManagerRef.current = new CesiumOverlayManager(viewer);

    return () => {
      overlayManagerRef.current?.destroy();
      overlayManagerRef.current = null;
    };
  }, [viewer]);

  const runWorkflow = useCallback(async (workflow, roi) => {
    if (!roi || !overlayManagerRef.current) {
      return;
    }

    setWorkflowLoading(workflow);

    try {
      const response =
        workflow === "detect"
          ? await runDetectInference(createDetectPayload(roi))
          : await runForecastInference(createForecastPayload(roi));

      overlayManagerRef.current.renderInferenceResult({
        workflow,
        roi,
        response,
      });
      setWorkflowResult(workflow, response);
    } catch (error) {
      setWorkflowError(workflow, error);
    }
  }, []);

  return {
    runDetect: useCallback((roi) => runWorkflow("detect", roi), [runWorkflow]),
    runForecast: useCallback((roi) => runWorkflow("forecast", roi), [runWorkflow]),
    overlayManagerRef,
  };
}
