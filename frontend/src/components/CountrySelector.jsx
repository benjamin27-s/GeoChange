import { useMemo, useState } from "react";

import { CONTINENTS, getCountryName } from "../services/countries.js";

// Deprecated Leaflet-era selector. Kept as migration reference only.
export default function CountrySelector({
  countriesByContinent,
  countryLoadError,
  selectedContinent,
  selectedCountry,
  onContinentChange,
  onCountrySelect,
}) {
  const [query, setQuery] = useState("");
  const countries = countriesByContinent.get(selectedContinent) || [];
  const selectedName = selectedCountry ? getCountryName(selectedCountry) : "";

  const filteredCountries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return countries;
    }

    return countries.filter((country) =>
      getCountryName(country).toLowerCase().includes(normalizedQuery),
    );
  }, [countries, query]);

  return (
    <section className="border border-cyanGlow/15 bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
        Country Targeting
      </p>

      <label className="mt-3 block text-xs text-slate-400" htmlFor="continent">
        Continent
      </label>
      <select
        id="continent"
        className="mt-1 w-full border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cyanGlow/60"
        value={selectedContinent}
        onChange={(event) => {
          setQuery("");
          onContinentChange(event.target.value);
        }}
      >
        {CONTINENTS.map((continent) => (
          <option key={continent} value={continent}>
            {continent}
          </option>
        ))}
      </select>

      <label className="mt-3 block text-xs text-slate-400" htmlFor="country-search">
        Country
      </label>
      <input
        id="country-search"
        className="mt-1 w-full border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyanGlow/60"
        placeholder="Search country"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="mt-3 max-h-44 overflow-y-auto border border-white/8">
        {countryLoadError && (
          <div className="px-3 py-2 text-xs text-red-300">{countryLoadError}</div>
        )}

        {!countryLoadError &&
          filteredCountries.map((country) => {
            const countryName = getCountryName(country);
            const isSelected = selectedName === countryName;

            return (
              <button
                key={`${country.properties?.["ISO3166-1-Alpha-3"]}-${countryName}`}
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? "bg-mintGlow/14 text-white"
                    : "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                }`}
                onClick={() => onCountrySelect(country)}
              >
                {countryName}
              </button>
            );
          })}

        {!countryLoadError && filteredCountries.length === 0 && (
          <div className="px-3 py-2 text-xs text-slate-500">No countries found</div>
        )}
      </div>
    </section>
  );
}
