import CountrySelector from "./CountrySelector.jsx";
import { getCountryName } from "../services/countries.js";

// Deprecated Leaflet-era sidebar. The active shell is components/AppShell.jsx.
export default function Sidebar({
  countriesByContinent,
  countryLoadError,
  selectedContinent,
  selectedCountry,
  selectedCoordinates,
  onContinentChange,
  onCountrySelect,
}) {
  const countryName = selectedCountry ? getCountryName(selectedCountry) : "None";
  const coordinateText = selectedCoordinates
    ? `${selectedCoordinates.latitude.toFixed(4)}, ${selectedCoordinates.longitude.toFixed(4)}`
    : "None";

  return (
    <aside className="pointer-events-auto fixed left-5 top-24 z-30 w-80 border border-white/10 bg-slate-950/88 p-4">
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.24em] text-cyanGlow/70">
          System Monitor
        </p>
        <h2 className="mt-2 text-lg font-semibold text-white">Geospatial AI Core</h2>
      </div>

      <CountrySelector
        countriesByContinent={countriesByContinent}
        countryLoadError={countryLoadError}
        selectedContinent={selectedContinent}
        selectedCountry={selectedCountry}
        onContinentChange={onContinentChange}
        onCountrySelect={onCountrySelect}
      />

      <section className="mt-4 border border-white/10 bg-white/[0.025] p-3">
        <label className="block text-xs text-slate-400" htmlFor="city-search">
          State / city
        </label>
        <input
          id="city-search"
          className="mt-1 w-full border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyanGlow/60"
          placeholder="City search placeholder"
          disabled
        />
      </section>

      <dl className="mt-5 grid gap-3 text-sm">
        <div className="flex items-center justify-between border-b border-white/8 pb-2">
          <dt className="text-slate-400">Backend</dt>
          <dd className="text-mintGlow">Ready</dd>
        </div>
        <div className="flex items-center justify-between border-b border-white/8 pb-2">
          <dt className="text-slate-400">Map</dt>
          <dd className="text-slate-100">OpenStreetMap</dd>
        </div>
        <div className="flex items-center justify-between border-b border-white/8 pb-2">
          <dt className="text-slate-400">Selected Region</dt>
          <dd className="max-w-36 truncate text-slate-100">{countryName}</dd>
        </div>
        <div className="flex items-center justify-between border-b border-white/8 pb-2">
          <dt className="text-slate-400">Pinned Location</dt>
          <dd className="max-w-40 truncate text-slate-100">{coordinateText}</dd>
        </div>
        <div className="flex items-center justify-between border-b border-white/8 pb-2">
          <dt className="text-slate-400">Change Model</dt>
          <dd className="text-slate-200">Standby</dd>
        </div>
        <div className="flex items-center justify-between border-b border-white/8 pb-2">
          <dt className="text-slate-400">Forecast Model</dt>
          <dd className="text-slate-200">Standby</dd>
        </div>
      </dl>

      <div className="mt-6 border border-cyanGlow/15 bg-white/[0.03] p-3">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Future Metrics</p>
        <div className="mt-3 h-24 border border-white/8 bg-slate-950/50" />
      </div>
    </aside>
  );
}
