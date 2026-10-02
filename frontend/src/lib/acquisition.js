export function formatDatePairs(response, workflow, params) {
  if (workflow === "detect") {
    const requested = response.requested_timestamps || [
      params?.startDate,
      params?.endDate,
    ];
    const actual = response.selected_timestamps || [];
    const acquisition = response.acquisition || {};

    return [
      {
        label: "Start (T1)",
        requested: requested[0],
        actual: acquisition.T1?.actual_date || actual[0],
        adaptive: acquisition.T1?.adaptive_selection,
      },
      {
        label: "End (T2)",
        requested: requested[1],
        actual: acquisition.T2?.actual_date || actual[1],
        adaptive: acquisition.T2?.adaptive_selection,
      },
    ];
  }

  const actual = response.selected_timestamps || [];
  const target = params?.targetDate;

  return actual.map((date, index) => ({
    label: `Frame T${index + 1}`,
    requested: target && index === actual.length - 1 ? target : "Auto-selected",
    actual: date,
    adaptive: true,
  }));
}
