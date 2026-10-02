import { detectionStats } from "../overlays/detection/detectionMetadata.js";
import { forecastStats } from "../overlays/forecast/forecastMetadata.js";
import { useOverlayState } from "../overlays/layers/overlayStore.js";

export default function OverlayControlPanel({ overlayManagerRef }) {
  const { layers, activeResult } = useOverlayState();

  if (!layers.length) {
    return null;
  }

  const workflow = activeResult?.workflow;
  const result = activeResult?.response;
  const stats = workflow === "detect" ? detectionStats(result) : forecastStats(result);

  return (
    <section className="overlay-panel">
      <div className="overlay-panel__header">
        <p>AI Overlays</p>
        <h2>{workflow === "detect" ? "Change Detection" : "Forecast Preview"}</h2>
      </div>

      <div className="overlay-panel__layers">
        {layers.map((layer) => (
          <div className="overlay-layer" key={layer.id}>
            <label>
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={(event) =>
                  overlayManagerRef.current?.setLayerVisible(layer.id, event.target.checked)
                }
              />
              <span>{layer.label}</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={layer.opacity}
              onChange={(event) =>
                overlayManagerRef.current?.setLayerOpacity(layer.id, Number(event.target.value))
              }
              aria-label={`${layer.label} opacity`}
            />
          </div>
        ))}
      </div>

      <dl className="overlay-panel__stats">
        {stats.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
