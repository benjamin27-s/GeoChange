import { closeRoiPopup, useInteractionState } from "../state/interactionStore.js";
import { useWorkflowState } from "../workflows/workflowStore.js";

function formatCoordinate(value) {
  return Number.isFinite(value) ? value.toFixed(5) : "--";
}

export default function RoiActionPopup({ onDetect, onForecast }) {
  const { activeRoi, popupVisible, pendingWorkflow } = useInteractionState();
  const workflow = useWorkflowState();

  if (!popupVisible || !activeRoi) {
    return null;
  }

  const { center, dimensions, bbox } = activeRoi;
  const workflowText = pendingWorkflow
    ? pendingWorkflow.type.replaceAll("-", " ")
    : workflow.message;
  const busy = workflow.status === "loading";

  return (
    <section className="roi-popup" aria-label="ROI action panel">
      <div className="roi-popup__header">
        <div>
          <p>Selected ROI</p>
          <h2>Inference Target</h2>
        </div>
        <button type="button" onClick={closeRoiPopup} aria-label="Close ROI panel">
          x
        </button>
      </div>

      <dl className="roi-popup__metrics">
        <div>
          <dt>Latitude</dt>
          <dd>{formatCoordinate(center.latitude)}</dd>
        </div>
        <div>
          <dt>Longitude</dt>
          <dd>{formatCoordinate(center.longitude)}</dd>
        </div>
        <div>
          <dt>Altitude</dt>
          <dd>{Math.round(center.altitude).toLocaleString()} m</dd>
        </div>
        <div>
          <dt>ROI</dt>
          <dd>{dimensions.widthKm} x {dimensions.heightKm} km</dd>
        </div>
      </dl>

      <div className="roi-popup__bbox">
        <span>W {formatCoordinate(bbox.west)}</span>
        <span>S {formatCoordinate(bbox.south)}</span>
        <span>E {formatCoordinate(bbox.east)}</span>
        <span>N {formatCoordinate(bbox.north)}</span>
      </div>

      <div className="roi-popup__actions">
        <button type="button" disabled={busy} onClick={() => onDetect?.(activeRoi)}>
          Detect Change
        </button>
        <button type="button" disabled={busy} onClick={() => onForecast?.(activeRoi)}>
          Forecast
        </button>
      </div>

      <p className="roi-popup__status">{workflowText}</p>
    </section>
  );
}
