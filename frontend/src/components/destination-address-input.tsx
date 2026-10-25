/// <reference types="google.maps" />
import { useState, useEffect, useRef, useCallback } from "react";
import { loadGoogleMaps } from "@/utils/geocode";
import { importLibrary } from "@googlemaps/js-api-loader";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";

export interface PlaceResult {
  lat: number;
  lng: number;
  formattedAddress: string;
}

interface SuggestionItem {
  text: string;
  placePrediction: { toPlace: () => Promise<google.maps.places.Place> };
}

const DEBOUNCE_MS = 300;

export interface DestinationAddressInputProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (result: PlaceResult) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export default function DestinationAddressInput({
  value,
  onChange,
  onPlaceSelect,
  placeholder,
  disabled,
  id,
  className,
}: DestinationAddressInputProps) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const requestIdRef = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const skipNextFetchRef = useRef(false);

  const fetchSuggestions = useCallback(async (input: string) => {
    if (!input.trim()) {
      setSuggestions([]);
      setDropdownOpen(false);
      return;
    }
    const reqId = ++requestIdRef.current;
    setLoading(true);
    try {
      await loadGoogleMaps();
      const places = (await importLibrary("places")) as google.maps.PlacesLibrary;
      const AutocompleteSuggestion = places?.AutocompleteSuggestion;
      const AutocompleteSessionToken = places?.AutocompleteSessionToken;
      if (!AutocompleteSuggestion || !AutocompleteSessionToken) {
        setSuggestions([]);
        return;
      }
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }
      const { suggestions: result } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: input.trim(),
        sessionToken: sessionTokenRef.current,
      } as google.maps.places.AutocompleteRequest);
      if (reqId !== requestIdRef.current) return;
      const items: SuggestionItem[] = [];
      for (const s of result ?? []) {
        const pp = s.placePrediction;
        if (!pp) continue;
        const ft = pp.text;
        const text = ft?.text ?? "";
        items.push({ text, placePrediction: pp });
      }
      setSuggestions(items);
      setDropdownOpen(items.length > 0);
    } catch {
      if (reqId === requestIdRef.current) {
        setSuggestions([]);
        setDropdownOpen(false);
      }
    } finally {
      if (reqId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    const t = window.setTimeout(() => fetchSuggestions(value), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [value, fetchSuggestions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    async (item: SuggestionItem) => {
      try {
        const place = await item.placePrediction.toPlace();
        await place.fetchFields({ fields: ["formattedAddress", "location"] });
        const loc = place.location;
        if (!loc) return;
        const lat = typeof loc.lat === "function" ? loc.lat() : (loc as { lat: number }).lat;
        const lng = typeof loc.lng === "function" ? loc.lng() : (loc as { lng: number }).lng;
        const formattedAddress = place.formattedAddress ?? item.text;
        sessionTokenRef.current = null;
        setSuggestions([]);
        setDropdownOpen(false);
        skipNextFetchRef.current = true;
        onChange(formattedAddress);
        onPlaceSelect({ lat, lng, formattedAddress });
      } catch {
        // ignore
      }
    },
    [onChange, onPlaceSelect]
  );

  return (
    <div ref={wrapperRef} className="relative flex-1 min-w-0">
      <Input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => value.trim() && suggestions.length > 0 && setDropdownOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={className}
      />
      {dropdownOpen && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 w-full max-h-48 overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-overlay py-1 text-sm"
          role="listbox"
        >
          {suggestions.map((item, i) => (
            <li key={i} role="option">
              <button
                type="button"
                className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                onClick={() => handleSelect(item)}
              >
                {item.text}
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          {t("addressInput.searching")}
        </span>
      )}
    </div>
  );
}
