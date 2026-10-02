// Deprecated Leaflet-era top bar. The active Cesium UI lives in panels/.
export default function TopBar() {
  return (
    <header className="fixed left-0 right-0 top-0 z-30 border-b border-white/10 bg-slate-950/92 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyanGlow/70">
            Satellite Intelligence
          </p>
          <h1 className="mt-1 text-xl font-semibold text-white">
            AI Geospatial Dashboard
          </h1>
        </div>

        <div className="hidden items-center gap-3 text-xs uppercase tracking-[0.18em] text-slate-400 sm:flex">
          <span className="h-2 w-2 bg-mintGlow" />
          Performance Map Mode
        </div>
      </div>
    </header>
  );
}
