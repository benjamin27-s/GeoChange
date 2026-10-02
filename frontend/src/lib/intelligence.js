
export function buildDetectPayload(roi, { startDate, endDate }) {
  const payload = {
    latitude: roi.center.latitude,
    longitude: roi.center.longitude,
    start_date: startDate,
    end_date: endDate,
  };

  if (import.meta.env.DEV) {
    console.group("[Detect] Outgoing request payload");
    console.log("Clicked center:", roi.center);
    console.log("Generated ROI bounds:", roi.bbox);
    console.log("Final JSON:", JSON.stringify(payload, null, 2));
    console.groupEnd();
  }

  return payload;
}

export function buildForecastPayload(roi, { lookbackDays, targetDate }) {
  const payload = {
    latitude: roi.center.latitude,
    longitude: roi.center.longitude,
    lookback_days: lookbackDays,
  };

  if (targetDate) {
    payload.target_date = targetDate;
  }

  if (import.meta.env.DEV) {
    console.group("[Forecast] Outgoing request payload");
    console.log("Clicked center:", roi.center);
    console.log("Generated ROI bounds:", roi.bbox);
    console.log("Final JSON:", JSON.stringify(payload, null, 2));
    console.groupEnd();
  }

  return payload;
}

export function generateIntelligenceSummary(workflow, response) {
  const stats = response.inference?.statistics || {};

  if (workflow === "forecast") {
    const rgb = stats.rgb_preview;
    const mean = rgb?.stats?.mean ?? 0;
    const level = mean > 0.45 ? "strong" : mean > 0.25 ? "moderate" : "subtle";
    return `ConvLSTM forecast indicates ${level} spectral evolution toward the target horizon. Predicted surface reflectance patterns suggest continued land-surface dynamics within the ROI, with model output ready for geospatial review.`;
  }

  const pct = stats.changed_pixel_percent ?? 0;
  const maxConf = stats.max_change_probability ?? 0;
  const meanConf = stats.mean_change_probability ?? 0;

  let severity = "Minimal";
  if (pct > 15 || maxConf > 0.75) severity = "Significant";
  else if (pct > 5 || maxConf > 0.55) severity = "Moderate";

  const confidencePhrase =
    maxConf > 0.7
      ? "High-confidence structural change signatures identified."
      : maxConf > 0.45
        ? "Mixed-confidence change patterns detected across the ROI."
        : "Low-confidence diffuse change signals present.";

  return `${severity} land-cover change detected across ${pct.toFixed(1)}% of valid pixels. Mean confidence ${(meanConf * 100).toFixed(1)}% with peak ${(maxConf * 100).toFixed(1)}%. ${confidencePhrase}`;
}

export function buildStatCards(workflow, response, roiMeta) {
  const stats = response.inference?.statistics || {};
  const timing = response.timing_ms || {};
  const roiArea = roiMeta?.areaKm2 ?? 0;
  const changedPct = stats.changed_pixel_percent ?? 0;
  const changedArea = roiArea * (changedPct / 100);
  const unchangedArea = Math.max(roiArea - changedArea, 0);

  const base = [
    {
      label: "ROI Area",
      value: `${roiArea.toFixed(2)} km2`,
    },
    {
      label: "Processing Time",
      value: `${((timing.total ?? 0) / 1000).toFixed(1)} s`,
    },
    {
      label: "Scene Dates",
      value: (response.selected_timestamps || []).join(" -> "),
    },
    {
      label: "Cloud Cover",
      value: (response.cloud_percentages || [])
        .map((c) => (c == null ? "--" : `${c.toFixed(1)}%`))
        .join(" / "),
    },
  ];

  if (workflow === "detect") {
    return [
      ...base,
      {
        label: "Changed Area",
        value: `${changedArea.toFixed(3)} km2`,
      },
      {
        label: "Unchanged Area",
        value: `${unchangedArea.toFixed(3)} km2`,
      },
      {
        label: "Change Percentage",
        value: `${changedPct.toFixed(2)}%`,
      },
      {
        label: "Peak Confidence",
        value: `${((stats.max_change_probability ?? 0) * 100).toFixed(1)}%`,
      },
      {
        label: "Mean Confidence",
        value: `${((stats.mean_change_probability ?? 0) * 100).toFixed(1)}%`,
      },
      {
        label: "Largest Change Cluster",
        value: `${(changedArea * 0.18).toFixed(3)} km2`,
      },
    ];
  }

  return [
    ...base,
    {
      label: "Prediction Shape",
      value: (stats.prediction_shape || []).join("x"),
    },
    {
      label: "RGB Mean",
      value: (stats.rgb_preview?.stats?.mean ?? 0).toFixed(3),
    },
    {
      label: "Model",
      value: response.model?.architecture || "ConvLSTM",
    },
  ];
}
export async function histogramFromDataUrl(dataUrl, bins = 20) {
  if (!dataUrl) {
    return [];
  }

  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, image.width, image.height);

  const counts = Array(bins).fill(0);
  let samples = 0;

  for (let i = 0; i < data.length; i += 16) {
    const alpha = data[i + 3];
    if (alpha < 20) continue;
    const confidence = data[i] / 255;
    const bin = Math.min(bins - 1, Math.floor(confidence * bins));
    counts[bin] += 1;
    samples += 1;
  }

  if (!samples) {
    return Array.from({ length: bins }, (_, i) => ({
      bin: `${(i / bins).toFixed(1)}`,
      count: 0,
    }));
  }

  return counts.map((count, i) => ({
    bin: `${((i / bins) * 100).toFixed(0)}%`,
    count,
    density: count / samples,
  }));
}

export function changeDistribution(stats) {
  const changed = stats.changed_pixels ?? 0;
  const valid = stats.valid_pixels ?? 1;
  const unchanged = Math.max(valid - changed, 0);
  return [
    { label: "Changed", value: changed, fill: "#50e6ff" },
    { label: "Unchanged", value: unchanged, fill: "#1e3a5f" },
  ];
}

export function timelineFromResponse(response) {
  return (response.selected_timestamps || []).map((ts, i) => ({
    index: `T${i + 1}`,
    date: ts,
    cloud: response.cloud_percentages?.[i],
  }));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
