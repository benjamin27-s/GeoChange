import { useInteractionState } from "../state/interactionStore.js";

export default function StatusPanel({ status }) {
  const { interactionMode, activeRoi } = useInteractionState();
  const normalizedStatus = status === "online" ? "Nominal" : "Booting";

  return (
    <section className="status-panel">
      <div>
        <p>Globe System</p>
        <strong>{normalizedStatus}</strong>
      </div>
      <div>
        <p>Mode</p>
        <strong>{interactionMode}</strong>
      </div>
      <div>
        <p>Active ROI</p>
        <strong>{activeRoi ? activeRoi.id.slice(-6) : "None"}</strong>
      </div>
    </section>
  );
}
