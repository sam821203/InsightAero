import { useRef, useCallback, useEffect } from "react";
import { loadGoogleMaps } from "@/utils/geocode";
import { getStoredTheme } from "@/contexts/themeStorage";

const MAP_STYLES = {
  dark: [
    { elementType: "geometry", stylers: [{ color: "#1a2332" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#1a2332" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#e2e8f0" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1628" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d3748" }] },
  ],
  light: [
    { elementType: "geometry", stylers: [{ color: "#f5f0e6" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#5f6368" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#aad3df" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  ],
} as const;

const MAP_BG = { dark: "#323338", light: "#f5f0e6" } as const;

export interface UseDroneMapOptions {
  center: { lat: number; lng: number };
  zoom?: number;
  theme?: "dark" | "light";
}

/**
 * Encapsulates Google Map instance creation and center/zoom. Parent renders a div with
 * the returned containerRef; the map is created inside it. Pass mapRef to GoogleMapView
 * so it can attach overlays without owning map creation.
 */
export function useDroneMap(options: UseDroneMapOptions) {
  const { center, zoom = 15, theme = getStoredTheme() } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const initMap = useCallback(() => {
    const container = containerRef.current;
    if (!container || !container.isConnected || mapRef.current) return;
    const { center: c, zoom: z } = optionsRef.current;
    loadGoogleMaps()
      .then(() => {
        const initialTheme = getStoredTheme();
        const map = new google.maps.Map(container, {
          center: { lat: c.lat, lng: c.lng },
          zoom: z ?? 15,
          styles: MAP_STYLES[initialTheme],
          disableDefaultUI: true,
          zoomControl: true,
          backgroundColor: MAP_BG[initialTheme],
        });
        mapRef.current = map;
        resizeObserverRef.current = new ResizeObserver(() => {
          if (mapRef.current && typeof google !== "undefined" && google.maps?.event) {
            google.maps.event.trigger(mapRef.current, "resize");
          }
        });
        resizeObserverRef.current.observe(container);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    initMap();
    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      mapRef.current = null;
    };
  }, [initMap]);

  useEffect(() => {
    if (!mapRef.current) return;
    const t = theme ?? getStoredTheme();
    mapRef.current.setOptions({
      styles: MAP_STYLES[t],
      backgroundColor: MAP_BG[t],
    });
  }, [theme]);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setCenter({ lat: center.lat, lng: center.lng });
  }, [center.lat, center.lng]);

  return { containerRef, mapRef, initMap };
}
