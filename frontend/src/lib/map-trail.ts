/**
 * A drone's flight trail drawn as two polylines: a wide casing in the map's
 * contrast color underneath, and the colored line on top. The casing
 * separates the trail from roads of a similar width, the same way map apps
 * outline routes.
 */

type Path = google.maps.LatLngLiteral[];

export interface TrailStyle {
  color: string;
  casingColor: string;
  /** The selected drone's trail is fully opaque and drawn above the others. */
  emphasized: boolean;
}

const LINE_WEIGHT = 4;
const CASING_WEIGHT = 8;
const DIMMED_OPACITY = 0.45;

export class Trail {
  private readonly casing: google.maps.Polyline;
  private readonly line: google.maps.Polyline;

  constructor(map: google.maps.Map, path: Path, style: TrailStyle) {
    this.casing = new google.maps.Polyline({ map, path, geodesic: true, strokeWeight: CASING_WEIGHT, clickable: false });
    this.line = new google.maps.Polyline({ map, path, geodesic: true, strokeWeight: LINE_WEIGHT, clickable: false });
    this.setStyle(style);
  }

  setPath(path: Path) {
    this.casing.setPath(path);
    this.line.setPath(path);
  }

  setMap(map: google.maps.Map | null) {
    this.casing.setMap(map);
    this.line.setMap(map);
  }

  setStyle({ color, casingColor, emphasized }: TrailStyle) {
    const base = emphasized ? 2 : 0;
    this.casing.setOptions({
      strokeColor: casingColor,
      strokeOpacity: emphasized ? 0.85 : DIMMED_OPACITY * 0.85,
      zIndex: base,
    });
    this.line.setOptions({
      strokeColor: color,
      strokeOpacity: emphasized ? 1 : DIMMED_OPACITY,
      zIndex: base + 1,
    });
  }
}

/** Polyline options for a planned route: a dashed line, so it reads as "not flown yet". */
export function plannedRouteOptions(color: string): google.maps.PolylineOptions {
  return {
    geodesic: true,
    clickable: false,
    strokeOpacity: 0,
    icons: [
      {
        icon: { path: "M 0,-1 0,1", strokeColor: color, strokeOpacity: 0.9, strokeWeight: 2, scale: 2 },
        offset: "0",
        repeat: "12px",
      },
    ],
  };
}
