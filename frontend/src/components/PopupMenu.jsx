import { getCountryName } from "../services/countries.js";

// Deprecated Leaflet-era popup. The Cesium foundation uses panels/controls instead.
export default function PopupMenu({ country, coordinates, isVisible, position, onClose }) {
  if (!isVisible || !country || !position) {
    return null;
  }

  const countryName = getCountryName(country);
  const coordinateText = coordinates
    ? `${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)}`
    : "No location pinned";

  const style = {
    left: Math.min(position.x + 18, window.innerWidth - 280),
    top: Math.min(position.y + 18, window.innerHeight - 190),
  };

  return (
    <div
      className="fixed z-40 w-64 border border-cyanGlow/25 bg-slate-950/92 p-3"
      style={style}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-cyanGlow/70">Pinned ROI</p>
          <h2 className="mt-1 text-sm font-semibold text-white">{countryName}</h2>
          <p className="mt-1 text-xs text-slate-400">{coordinateText}</p>
        </div>
        <button
          type="button"
          className="grid h-7 w-7 place-items-center border border-white/10 text-sm text-slate-300 transition hover:border-cyanGlow/50 hover:text-white"
          onClick={onClose}
          aria-label="Close country actions"
        >
          x
        </button>
      </div>

      <div className="grid gap-2">
        <button
          type="button"
          className="border border-cyanGlow/30 bg-cyanGlow/10 px-3 py-2 text-left text-sm font-medium text-cyan-50 transition hover:border-cyanGlow/70 hover:bg-cyanGlow/18"
        >
          Detect
        </button>
        <button
          type="button"
          className="border border-mintGlow/30 bg-mintGlow/10 px-3 py-2 text-left text-sm font-medium text-emerald-50 transition hover:border-mintGlow/70 hover:bg-mintGlow/18"
        >
          Forecast Next Observation
        </button>
      </div>
    </div>
  );
}
