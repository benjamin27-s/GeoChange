import { hasCesiumIonToken } from "../core/environment.js";

export default function MissionHud() {
  return (
    <aside className="mission-hud">
      <div>
        <p className="hud-kicker">Planetary Ops</p>
        <h1>AI Geospatial Command</h1>
      </div>

      <dl>
        <div>
          <dt>Renderer</dt>
          <dd>CesiumJS WebGL</dd>
        </div>
        <div>
          <dt>Terrain</dt>
          <dd>World Terrain</dd>
        </div>
        <div>
          <dt>Ion Token</dt>
          <dd>{hasCesiumIonToken() ? "Configured" : "Missing"}</dd>
        </div>
        <div>
          <dt>AI Layers</dt>
          <dd>Standby</dd>
        </div>
      </dl>
    </aside>
  );
}
