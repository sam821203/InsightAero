/// <reference types="google.maps" />
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

let loadPromise: Promise<void> | null = null;

/**
 * Load Google Maps JavaScript API with the new loader (v=weekly) so that
 * Places API (New) and importLibrary are available.
 */
export function loadGoogleMaps(): Promise<void> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not set"));
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    if (typeof window !== "undefined" && (window as unknown as { google?: { maps: unknown } }).google?.maps) {
      return;
    }
    setOptions({ key, v: "weekly" });
    await importLibrary("maps");
  })();
  return loadPromise;
}

/**
 * Geocode an address string to lat/lng using Google Geocoder.
 * Returns null if the address cannot be resolved (ZERO_RESULTS, no geometry, or API error).
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  const trimmed = address?.trim();
  if (!trimmed) return null;
  try {
    await loadGoogleMaps();
  } catch {
    return null;
  }
  if (typeof google === "undefined" || !google.maps?.Geocoder) return null;
  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: trimmed }, (results, status) => {
      if (status !== "OK" || !results?.length) {
        resolve(null);
        return;
      }
      const loc = results[0].geometry?.location;
      if (!loc) {
        resolve(null);
        return;
      }
      const lat = typeof loc.lat === "function" ? loc.lat() : (loc as { lat: number }).lat;
      const lng = typeof loc.lng === "function" ? loc.lng() : (loc as { lng: number }).lng;
      if (typeof lat !== "number" || typeof lng !== "number") {
        resolve(null);
        return;
      }
      resolve({ lat, lng });
    });
  });
}
