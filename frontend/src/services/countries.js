// Deprecated Leaflet-era country polygon service. Future Cesium layers should live
// under overlays/ and stream only the data needed for active AI workflows.
const COUNTRIES_GEOJSON_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const COUNTRY_METADATA_URL =
  "https://restcountries.com/v3.1/all?fields=cca2,cca3,name,continents";

export const CONTINENTS = [
  "Africa",
  "Antarctica",
  "Asia",
  "Europe",
  "North America",
  "Oceania",
  "South America",
  "Other",
];

export function getCountryName(country) {
  return (
    country?.properties?.displayName ||
    country?.properties?.NAME ||
    country?.properties?.ADMIN ||
    country?.properties?.name ||
    country?.name?.common ||
    "Unknown region"
  );
}

export function getCountryIso3(country) {
  return (
    country?.properties?.["ISO3166-1-Alpha-3"] ||
    country?.properties?.ISO_A3 ||
    country?.properties?.ADM0_A3 ||
    country?.properties?.iso_a3 ||
    country?.cca3 ||
    ""
  );
}

function getCountryIso2(country) {
  return (
    country?.properties?.["ISO3166-1-Alpha-2"] ||
    country?.properties?.ISO_A2 ||
    country?.cca2 ||
    ""
  );
}

async function loadCountryMetadata() {
  const response = await fetch(COUNTRY_METADATA_URL);

  if (!response.ok) {
    throw new Error("Unable to load country metadata");
  }

  const countries = await response.json();
  const byIso3 = new Map();
  const byIso2 = new Map();
  const byName = new Map();

  countries.forEach((country) => {
    const metadata = {
      continent: country.continents?.[0] || "Other",
      displayName: country.name?.common,
    };

    if (country.cca3) {
      byIso3.set(country.cca3, metadata);
    }

    if (country.cca2) {
      byIso2.set(country.cca2, metadata);
    }

    if (country.name?.common) {
      byName.set(country.name.common.toLowerCase(), metadata);
    }

    if (country.name?.official) {
      byName.set(country.name.official.toLowerCase(), metadata);
    }
  });

  return { byIso3, byIso2, byName };
}

export async function loadCountries() {
  const [geojson, metadata] = await Promise.all([
    fetch(COUNTRIES_GEOJSON_URL).then((response) => {
      if (!response.ok) {
        throw new Error("Unable to load country GeoJSON");
      }

      return response.json();
    }),
    loadCountryMetadata().catch(() => ({
      byIso3: new Map(),
      byIso2: new Map(),
      byName: new Map(),
    })),
  ]);

  return (geojson.features || [])
    .map((feature) => {
      const iso3 = getCountryIso3(feature);
      const iso2 = getCountryIso2(feature);
      const name = getCountryName(feature).toLowerCase();
      const adminName = feature.properties?.ADMIN?.toLowerCase();
      const formalName = feature.properties?.FORMAL_EN?.toLowerCase();
      const countryMetadata =
        metadata.byIso3.get(iso3) ||
        metadata.byIso2.get(iso2) ||
        metadata.byName.get(name) ||
        metadata.byName.get(adminName) ||
        metadata.byName.get(formalName) ||
        {};

      return {
        ...feature,
        properties: {
          ...feature.properties,
          displayName: countryMetadata.displayName || getCountryName(feature),
          continent: countryMetadata.continent || "Other",
        },
      };
    })
    .sort((first, second) =>
      getCountryName(first).localeCompare(getCountryName(second)),
    );
}

function visitCoordinateSets(coordinates, visitor) {
  if (typeof coordinates?.[0]?.[0] === "number") {
    coordinates.forEach(visitor);
    return;
  }

  coordinates?.forEach((child) => visitCoordinateSets(child, visitor));
}

export function getCountryBounds(country) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  visitCoordinateSets(country?.geometry?.coordinates, ([longitude, latitude]) => {
    west = Math.min(west, longitude);
    south = Math.min(south, latitude);
    east = Math.max(east, longitude);
    north = Math.max(north, latitude);
  });

  if (![west, south, east, north].every(Number.isFinite)) {
    return null;
  }

  return [
    [west, south],
    [east, north],
  ];
}
