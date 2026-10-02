import { useWorkflowState } from "../workflows/workflowStore.js";

export default function WorkflowStatusHud() {
  const { status, message, error, workflow } = useWorkflowState();

  if (status === "idle") {
    return null;
  }

  return (
    <section className={`workflow-hud workflow-hud--${status}`}>
      <div className="workflow-hud__pulse" />
      <div>
        <p>{workflow || "system"}</p>
        <strong>{message}</strong>
        {error && <span>{error}</span>}
      </div>
    </section>
  );
}
