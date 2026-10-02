import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { useMission } from "../../context/MissionContext.jsx";

export default function MissionLoading({ workflow }) {
  const { cancelMission, progress } = useMission();
  const label = workflow === "forecast" ? "Forecast" : "Detection";

  const stages =
    workflow === "forecast"
      ? [
          { index: 1, name: "Receiving coordinates" },
          { index: 2, name: "Querying Sentinel imagery" },
          { index: 3, name: "Applying cloud filtering" },
          { index: 4, name: "Selecting scenes" },
          { index: 5, name: "Downloading bands" },
          { index: 6, name: "Preprocessing tensors" },
          { index: 7, name: "Running inference" },
          { index: 8, name: "Generating visualization" },
          { index: 9, name: "Rendering visualization" },
        ]
      : [
          { index: 1, name: "Receiving coordinates" },
          { index: 2, name: "Querying Sentinel imagery" },
          { index: 3, name: "Applying cloud filtering" },
          { index: 4, name: "Selecting scenes" },
          { index: 5, name: "Downloading bands" },
          { index: 6, name: "Preprocessing tensors" },
          { index: 7, name: "Running inference" },
          { index: 8, name: "Generating heatmap" },
          { index: 9, name: "Rendering visualization" },
        ];

  const activeIndexRaw = progress?.index ?? progress?.stage_index ?? 1;
  const activeIndex = Math.max(1, Math.min(stages.length, activeIndexRaw || 1));
  const percent = progress?.percent ?? (activeIndex / stages.length) * 100;

  return (
    <motion.div
      className="mission-loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="mission-loading__blur" />
      <div className="mission-loading__scanline" />
      <div className="mission-loading__border-sweep" />
      <div className="mission-loading__border-glow" />

      <div className="mission-loading__center">
        <div className="mission-loading__ring">
          <Loader2 size={42} className="spin" />
        </div>
        <p className="mission-loading__label">{label} in progress</p>
        <div className="stage-progress" aria-label="Mission stage progress">
          <div
            className="stage-progress__bar"
            role="progressbar"
            aria-valuenow={Math.round(percent)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="stage-progress__bar-fill" style={{ width: `${percent}%` }} />
          </div>
          <div className="stage-progress__nodes">
            {stages.map((s) => {
              const completed = s.index < activeIndex;
              const active = s.index === activeIndex;
              return (
                <div
                  key={s.index}
                  className={[
                    "stage-progress__node",
                    completed ? "completed" : "",
                    active ? "active" : "",
                  ].join(" ")}
                >
                  <div className="stage-progress__dot">
                    {completed ? "✓" : s.index}
                  </div>
                  <div className="stage-progress__name">{s.name}</div>
                </div>
              );
            })}
          </div>
        </div>

        <p className="mission-loading__message">
          {progress?.name ? `Stage: ${progress.name}` : "Initializing mission pipeline..."}
        </p>

        <div className="mission-loading__actions">
          <button type="button" className="btn-ghost" onClick={cancelMission}>
            Cancel Mission
          </button>
          <button type="button" className="btn-primary" onClick={cancelMission}>
            Return To Map
          </button>
        </div>
      </div>
    </motion.div>
  );
}
