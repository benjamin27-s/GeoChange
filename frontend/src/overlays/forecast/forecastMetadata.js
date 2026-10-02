export function forecastStats(result) {
  const stats = result?.inference?.statistics;
  const rgbStats = stats?.rgb_preview?.stats;

  if (!stats || !rgbStats) {
    return [];
  }

  return [
    ["Prediction", stats.prediction_shape?.join("x") || "--"],
    ["RGB Mean", rgbStats.mean?.toFixed?.(3) ?? "0.000"],
    ["RGB Max", rgbStats.max?.toFixed?.(3) ?? "0.000"],
    ["Ready", stats.rgb_preview?.ready_for_visualization ? "Yes" : "No"],
  ];
}
