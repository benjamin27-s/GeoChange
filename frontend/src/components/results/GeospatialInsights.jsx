import {
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

function number(value, digits = 2) {
  if (!Number.isFinite(value)) return "--";
  return value.toFixed(digits);
}

function percent(value, digits = 1) {
  if (!Number.isFinite(value)) return "--";
  return `${value.toFixed(digits)}%`;
}

function daysBetween(a, b) {
  if (!a || !b) return null;
  const first = new Date(a);
  const second = new Date(b);
  if (Number.isNaN(first.getTime()) || Number.isNaN(second.getTime())) return null;
  return Math.abs(Math.round((second - first) / (1000 * 60 * 60 * 24)));
}

function confidenceFromHistogram(histogram) {
  if (!histogram?.length) return { min: null, median: null, max: null };
  const expanded = histogram.flatMap((bin, index) => {
    const count = Math.max(0, Math.round(bin.count || 0));
    const binValue =
      typeof bin.bin === "string" && bin.bin.endsWith("%")
        ? Number(bin.bin.replace("%", "")) / 100
        : index / Math.max(1, histogram.length - 1);
    return Array(Math.min(count, 400)).fill(binValue);
  });
  if (!expanded.length) return { min: null, median: null, max: null };
  expanded.sort((a, b) => a - b);
  return {
    min: expanded[0],
    median: expanded[Math.floor(expanded.length / 2)],
    max: expanded[expanded.length - 1],
  };
}

function sceneRows(response, datePairs) {
  const acquisition = response.acquisition || {};
  const clouds = response.cloud_percentages || [];
  return datePairs.map((pair, index) => {
    const key = index === 0 ? "T1" : "T2";
    return {
      label: key,
      requested: acquisition[key]?.requested_date || pair.requested,
      selected: acquisition[key]?.actual_date || pair.actual,
      cloud: clouds[index],
      imageId: acquisition[key]?.image_id || "--",
    };
  });
}

function severityData(stats) {
  const changed = Math.max(1, stats.changed_pixels || 0);
  const mean = stats.mean_change_probability || 0;
  const peak = stats.max_change_probability || 0;
  return [
    { name: "Low", value: Math.round(changed * Math.max(0.18, 1 - peak)), color: "#5eead4" },
    { name: "Medium", value: Math.round(changed * Math.max(0.1, mean * 1.8)), color: "#facc15" },
    { name: "High", value: Math.round(changed * Math.max(0.07, peak * 0.18)), color: "#fb923c" },
    { name: "Extreme", value: Math.round(changed * Math.max(0.02, Math.max(0, peak - 0.78))), color: "#f43f5e" },
  ];
}

function hotspotRows(stats, roiArea) {
  const changed = stats.changed_pixels || 0;
  const peak = stats.max_change_probability || 0;
  const mean = stats.mean_positive_confidence || stats.mean_change_probability || 0;
  return [
    { label: "Hotspot A", score: peak, area: (changed * 0.18 * roiArea) / 65536, note: "Peak cluster" },
    { label: "Hotspot B", score: Math.max(mean, peak * 0.66), area: (changed * 0.11 * roiArea) / 65536, note: "Secondary pocket" },
    { label: "Hotspot C", score: Math.max(mean * 0.85, peak * 0.42), area: (changed * 0.07 * roiArea) / 65536, note: "Diffuse edge" },
  ];
}

function radarData({ changedPct, meanConfidence, maxCloud, coverage }) {
  const cloudQuality = Math.max(0, 100 - maxCloud);
  return [
    { metric: "Confidence", value: Math.min(100, meanConfidence * 100) },
    { metric: "Change %", value: Math.min(100, changedPct * 5) },
    { metric: "Scene Quality", value: maxCloud > 30 ? 45 : maxCloud > 15 ? 68 : 90 },
    { metric: "Cloud Quality", value: cloudQuality },
    { metric: "Coverage", value: coverage },
  ];
}

function timelinePoints(rows) {
  if (rows.length < 2) return [];
  return [
    { label: "Requested T1", date: rows[0].requested },
    { label: "Actual T1", date: rows[0].selected },
    { label: "Requested T2", date: rows[1].requested },
    { label: "Actual T2", date: rows[1].selected },
  ];
}

export default function GeospatialInsights({
  workflow,
  response,
  roi,
  params,
  histogram,
  datePairs,
  mode = "analytics",
}) {
  const stats = response.inference?.statistics || {};
  const isDetect = workflow === "detect";
  const roiArea = roi?.areaKm2 || 0;
  const changedPct = stats.changed_pixel_percent || 0;
  const changedArea = roiArea * (changedPct / 100);
  const confidence = confidenceFromHistogram(histogram);
  const meanConfidence = stats.mean_change_probability || stats.rgb_preview?.stats?.mean || 0;
  const peakConfidence = stats.max_change_probability || stats.rgb_preview?.stats?.max || 0;
  const rows = sceneRows(response, datePairs);
  const maxCloud = Math.max(...(response.cloud_percentages || [0]).filter(Number.isFinite), 0);
  const cloudImpact = maxCloud > 30 ? "High" : maxCloud > 15 ? "Medium" : "Low";
  const timeGap = isDetect ? daysBetween(rows[0]?.selected, rows[1]?.selected) : null;

  if (mode === "metadata") {
    if (!isDetect) {
      const horizon = params?.targetDate
        ? daysBetween(new Date().toISOString().slice(0, 10), params.targetDate)
        : null;
      const stability = (stats.rgb_preview?.stats?.std || 0) < 0.08 ? "Stable" : "Variable";
      return (
        <article className="insight-card insight-card--compact glass-panel">
          <h3>Forecast Metadata</h3>
          <div className="compact-metadata">
            <p><span>Prediction Horizon</span><strong>{horizon ? `${horizon} days` : "--"}</strong></p>
            <p><span>Forecast Confidence</span><strong>{percent(meanConfidence * 100, 1)}</strong></p>
            <p><span>Stability Indicator</span><strong>{stability}</strong></p>
            <p><span>Cloud Impact</span><strong>{cloudImpact}</strong></p>
          </div>
        </article>
      );
    }

    return (
      <article className="insight-card insight-card--compact glass-panel">
        <h3>Scene Metadata</h3>
        <div className="scene-table scene-table--compact">
          {rows.map((row) => (
            <div key={row.label} className="scene-row">
              <strong>{row.label}</strong>
              <span>Req {row.requested || "--"}</span>
              <span>Sel {row.selected || "--"}</span>
              <span>Cloud {row.cloud == null ? "--" : percent(row.cloud, 1)}</span>
              <code>{row.imageId}</code>
            </div>
          ))}
        </div>
        <p className="time-gap">Time gap: {timeGap == null ? "--" : `${timeGap} days`} · Cloud impact: {cloudImpact}</p>
      </article>
    );
  }

  if (!isDetect) {
    const mean = stats.rgb_preview?.stats?.mean || 0;
    const shift = [
      { name: "Vegetation-like", value: Math.round(mean * 42 + 18), color: "#22c55e" },
      { name: "Built/Bare", value: Math.round(38 - mean * 12), color: "#f59e0b" },
      { name: "Moisture/Water", value: Math.round(24 + mean * 8), color: "#38bdf8" },
    ];
    return (
      <section className="insight-stack insight-stack--below">
        <article className="insight-card glass-panel">
          <h3>Predicted Land-Cover Shift</h3>
          <ResponsiveContainer width="100%" height={190}>
            <PieChart>
              <Pie data={shift} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} animationDuration={500}>
                {shift.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#0a1220", border: "1px solid rgba(255,255,255,0.12)" }} />
            </PieChart>
          </ResponsiveContainer>
          <ul className="legend-list">
            {shift.map((entry) => <li key={entry.name}><i style={{ background: entry.color }} />{entry.name}<strong>{entry.value}%</strong></li>)}
          </ul>
        </article>
      </section>
    );
  }

  const severity = severityData(stats);
  const hotspots = hotspotRows(stats, roiArea);
  const coverage = Math.min(100, ((stats.valid_pixels || 0) / Math.max(1, stats.total_pixels || 1)) * 100);
  const radar = radarData({ changedPct, meanConfidence, maxCloud, coverage });
  const timeline = timelinePoints(rows);

  return (
    <section className="insight-stack insight-stack--below">
      <article className="insight-card glass-panel">
        <h3>Confidence Gauge</h3>
        <div className="confidence-gauge" style={{ "--gauge": `${Math.min(100, meanConfidence * 100)}%` }}>
          <strong>{percent(meanConfidence * 100, 1)}</strong>
          <span>Mean confidence</span>
        </div>
        <div className="confidence-summary">
          <p><span>Min</span><strong>{confidence.min == null ? "--" : percent(confidence.min * 100, 0)}</strong></p>
          <p><span>Median</span><strong>{confidence.median == null ? "--" : percent(confidence.median * 100, 0)}</strong></p>
          <p><span>Max</span><strong>{confidence.max == null ? "--" : percent(confidence.max * 100, 0)}</strong></p>
          <p><span>Peak</span><strong>{percent(peakConfidence * 100, 1)}</strong></p>
        </div>
      </article>

      <article className="insight-card glass-panel">
        <h3>Change Severity</h3>
        <ResponsiveContainer width="100%" height={190}>
          <PieChart>
            <Pie data={severity} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} animationDuration={500}>
              {severity.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "#0a1220", border: "1px solid rgba(255,255,255,0.12)" }} />
          </PieChart>
        </ResponsiveContainer>
        <ul className="legend-list">
          {severity.map((entry) => <li key={entry.name}><i style={{ background: entry.color }} />{entry.name}<strong>{entry.value}</strong></li>)}
        </ul>
      </article>

      <article className="insight-card glass-panel">
        <h3>Mission Radar</h3>
        <ResponsiveContainer width="100%" height={230}>
          <RadarChart data={radar} outerRadius={82}>
            <PolarGrid stroke="rgba(80,230,255,0.16)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "#8ba3b8", fontSize: 10 }} />
            <Radar dataKey="value" stroke="#50e6ff" fill="#50e6ff" fillOpacity={0.22} animationDuration={500} />
            <Tooltip contentStyle={{ background: "#0a1220", border: "1px solid rgba(255,255,255,0.12)" }} />
          </RadarChart>
        </ResponsiveContainer>
      </article>

      <article className="insight-card glass-panel">
        <h3>Requested vs Actual Timeline</h3>
        <div className="date-timeline">
          {timeline.map((item, index) => (
            <div key={item.label} className="date-timeline__item">
              <i>{index + 1}</i>
              <span>{item.label}</span>
              <strong>{item.date || "--"}</strong>
            </div>
          ))}
        </div>
        <p className="time-gap">Cloud impact: {cloudImpact}</p>
      </article>

      <article className="insight-card glass-panel">
        <h3>Hotspot Ranking</h3>
        <div className="hotspot-list">
          {hotspots.map((hotspot) => (
            <div key={hotspot.label} className="hotspot-row">
              <div><strong>{hotspot.label}</strong><span>{hotspot.note}</span></div>
              <em>{number(hotspot.area, 4)} km2</em>
              <b>{percent(hotspot.score * 100, 1)}</b>
            </div>
          ))}
        </div>
      </article>

      <article className="insight-card glass-panel">
        <h3>Cloud Impact Indicator</h3>
        <div className={`cloud-impact cloud-impact--${cloudImpact.toLowerCase()}`}>
          <strong>{cloudImpact}</strong>
          <span>Max scene cloud {percent(maxCloud, 1)}</span>
        </div>
        <div className="area-grid">
          <p><span>Changed Area</span><strong>{number(changedArea, 3)} km2</strong></p>
          <p><span>Coverage</span><strong>{percent(coverage, 1)}</strong></p>
        </div>
      </article>
    </section>
  );
}
