export function getCesiumIonToken() {
  return import.meta.env.VITE_CESIUM_ION_TOKEN?.trim() || "";
}

export function hasCesiumIonToken() {
  return getCesiumIonToken().length > 0;
}
