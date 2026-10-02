import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";

import { searchPlaces } from "../../api/geocoding.js";
import GlassPanel from "../ui/GlassPanel.jsx";

export default function SearchBar({ onSelectPlace }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const places = await searchPlaces(query);
        setResults(places);
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <GlassPanel className="search-bar" as="div">
      <Search size={18} className="search-bar__icon" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search places worldwide..."
        aria-label="Search places"
      />
      {loading && <Loader2 size={16} className="spin search-bar__loader" />}

      {open && results.length > 0 && (
        <ul className="search-results">
          {results.map((place) => (
            <li key={place.place_id}>
              <button
                type="button"
                onClick={() => {
                  onSelectPlace({
                    latitude: Number(place.lat),
                    longitude: Number(place.lon),
                    label: place.display_name,
                    zoom: 11,
                  });
                  setQuery(place.display_name);
                  setOpen(false);
                }}
              >
                <MapPin size={14} />
                <span>{place.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
