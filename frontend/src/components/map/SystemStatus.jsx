import { Activity, Brain, Map, Satellite } from "lucide-react";

import GlassPanel from "../ui/GlassPanel.jsx";
import { API_BASE_URL } from "../../api/inferenceApi.js";

export default function SystemStatus({ roi, backendOnline }) {
  return (
    <GlassPanel className="system-status">
      <p className="system-status__title">System Status</p>
      <ul>
        <li>
          <Satellite size={14} />
          <span>Backend</span>
          <strong className={backendOnline ? "ok" : "warn"}>
            {backendOnline ? "Connected" : "Offline"}
          </strong>
        </li>
        <li>
          <Brain size={14} />
          <span>AI Models</span>
          <strong className="ok">Ready</strong>
        </li>
        <li>
          <Map size={14} />
          <span>Map Engine</span>
          <strong className="ok">MapLibre</strong>
        </li>
        <li>
          <Activity size={14} />
          <span>ROI</span>
          <strong>{roi ? `${roi.roiSizeKm.toFixed(0)} km` : "Click map"}</strong>
        </li>
      </ul>
      <p className="system-status__api">{API_BASE_URL}</p>
    </GlassPanel>
  );
}
