import { CAMERA_PRESETS } from "../camera/cameraPresets.js";
import { flyToPreset } from "../camera/navigation.js";

export default function CameraControls({ viewer }) {
  const canControl = Boolean(viewer && !viewer.isDestroyed?.());

  return (
    <div className="camera-controls" aria-label="Camera controls">
      <button
        type="button"
        disabled={!canControl}
        onClick={() => flyToPreset(viewer, "orbital")}
      >
        Earth
      </button>
      <button
        type="button"
        disabled={!canControl}
        onClick={() => flyToPreset(viewer, "tacticalIndia")}
      >
        Theater
      </button>
      <span>{CAMERA_PRESETS.orbital.duration.toFixed(1)}s fly path</span>
    </div>
  );
}
