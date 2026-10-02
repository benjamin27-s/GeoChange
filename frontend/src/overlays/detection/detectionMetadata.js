export function detectionStats(result) {
  const stats = result?.inference?.statistics;

  if (!stats) {
    return [];
  }

  return [
    ["Changed", `${stats.changed_pixel_percent?.toFixed?.(2) ?? "0.00"}%`],
    ["Pixels", `${stats.changed_pixels ?? 0}/${stats.valid_pixels ?? 0}`],
    ["Mean P", `${stats.mean_change_probability?.toFixed?.(3) ?? "0.000"}`],
    ["Max P", `${stats.max_change_probability?.toFixed?.(3) ?? "0.000"}`],
  ];
}
