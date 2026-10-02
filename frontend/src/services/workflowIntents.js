import { requestWorkflow } from "../state/interactionStore.js";

export function queueDetectWorkflow(roi) {
  requestWorkflow({
    type: "detect-change",
    roi,
    queuedAt: new Date().toISOString(),
  });
}

export function queuePredictWorkflow(roi) {
  requestWorkflow({
    type: "forecast-next-observation",
    roi,
    queuedAt: new Date().toISOString(),
  });
}
