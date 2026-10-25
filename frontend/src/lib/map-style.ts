import type { Theme } from "@/contexts/theme-storage";
import { readHexToken } from "@/lib/tokens";

/**
 * Google Maps base style built from the --color-map-* design tokens, so the
 * map follows the same palette and light/dark themes as the rest of the UI.
 *
 * The base map is deliberately quiet: low saturation, no business/POI icons,
 * no transit, muted labels. Color is left for what the app draws on top
 * (routes, markers, waypoints).
 *
 * This uses the JSON `styles` option, which works because the map has no
 * mapId. Switching to a mapId (cloud-based styling) would ignore these styles.
 */
export function buildMapStyle(theme: Theme): google.maps.MapTypeStyle[] {
  const c = (name: string) => readHexToken(`color-map-${name}`, theme);
  const hidden = [{ visibility: "off" }];

  return [
    { elementType: "geometry", stylers: [{ color: c("land") }] },
    { elementType: "labels.text.fill", stylers: [{ color: c("label") }] },
    { elementType: "labels.text.stroke", stylers: [{ color: c("label-halo") }, { weight: 3 }] },
    { elementType: "labels.icon", stylers: hidden },

    { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: c("boundary") }] },
    { featureType: "administrative.land_parcel", stylers: hidden },
    { featureType: "administrative.neighborhood", elementType: "labels", stylers: hidden },

    { featureType: "poi", stylers: hidden },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: c("park") }] },

    { featureType: "road", elementType: "geometry.fill", stylers: [{ color: c("road") }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: c("road-outline") }] },
    { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: c("road-major") }] },
    { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: c("road-major") }] },
    { featureType: "road.local", elementType: "labels", stylers: hidden },

    { featureType: "transit", stylers: hidden },

    { featureType: "water", elementType: "geometry", stylers: [{ color: c("water") }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: c("label") }] },
  ];
}

/** Background shown before tiles load; matches the land color to avoid a flash. */
export function mapBackground(theme: Theme): string {
  return readHexToken("color-map-land", theme);
}
