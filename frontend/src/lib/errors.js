const MISSION_FAILURE_MESSAGE =
  "Mission processing could not complete for this location and time range. Please retry with another nearby land-based region or broader temporal range.";

export function toFriendlyMissionError(error) {
  const message = error?.message || "";

  if (!message.trim()) {
    return null;
  }

  if (error?.name === "AbortError") {
    return null;
  }

  if (/^Click the map/i.test(message)) {
    return message;
  }

  if (/422|validation|unprocessable/i.test(message)) {
    return "Mission parameters could not be validated. Click the map to place a new ROI and retry.";
  }

  if (/sentinel|imagery|scene|404|not found|earth engine|503|acquisition/i.test(message)) {
    return MISSION_FAILURE_MESSAGE;
  }

  if (/timeout|aborted|network/i.test(message)) {
    return "Mission link interrupted. Check backend connectivity and retry.";
  }

  return MISSION_FAILURE_MESSAGE;
}
