const NOMINATIM_BASE = import.meta.env.DEV
  ? "/nominatim"
  : "https://nominatim.openstreetmap.org";

export async function searchPlaces(query) {
  if (!query?.trim()) {
    return [];
  }

  const params = new URLSearchParams({
    q: query.trim(),
    format: "json",
    limit: "6",
    addressdetails: "1",
  });

  const response = await fetch(`${NOMINATIM_BASE}/search?${params}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Geocoding search failed");
  }

  return response.json();
}
