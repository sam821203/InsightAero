/// <reference types="google.maps" />
import { useEffect, useRef } from "react";
import { useTheme } from "@/contexts/useTheme";
import { getStoredTheme } from "@/contexts/themeStorage";
import { loadGoogleMaps } from "@/utils/geocode";
import { readColorToken, readHexToken } from "@/lib/tokens";
import type {
  FlightPathPoint,
  FlightPathByDrone,
  TelemetryByDrone,
  TelemetryPacket,
} from "@/types/telemetry";

function buildDroneInfoContent(
  t: TelemetryPacket | undefined,
  id: number,
  theme: Theme
): string {
  const label = id === 0 ? "Drone-1" : `Drone-${id}`;
  const bg = readColorToken("map-infowindow-bg", theme);
  const text = readColorToken("map-infowindow-fg", theme);
  const muted = readColorToken("map-infowindow-muted", theme);
  if (!t) {
    return `<div style="padding:8px 12px;min-width:140px;background:${bg};color:${text};font-family:var(--font-ui);font-variant-numeric:tabular-nums;font-size:12px;">${label}<br/><span style="color:${muted}">無即時遙測</span></div>`;
  }
  const batteryPct = Math.max(0, t.battery);
  return `<div style="padding:10px 14px;min-width:180px;background:${bg};color:${text};font-family:var(--font-ui);font-variant-numeric:tabular-nums;font-size:12px;">
  <strong style="font-size:13px;">${label}</strong>
  <table style="margin-top:8px;width:100%;border-collapse:collapse;color:${text};">
    <tr><td style="color:${muted};padding:2px 6px 2px 0;">高度</td><td style="text-align:right;">${t.alt} m</td></tr>
    <tr><td style="color:${muted};padding:2px 6px 2px 0;">航向</td><td style="text-align:right;">${t.heading.toFixed(1)}°</td></tr>
    <tr><td style="color:${muted};padding:2px 6px 2px 0;">速度</td><td style="text-align:right;">${t.speed}</td></tr>
    <tr><td style="color:${muted};padding:2px 6px 2px 0;">有效速度</td><td style="text-align:right;">${t.effective_speed_m_min} m/min</td></tr>
    <tr><td style="color:${muted};padding:2px 6px 2px 0;">電量</td><td style="text-align:right;">${batteryPct.toFixed(1)}%</td></tr>
    <tr><td style="color:${muted};padding:2px 6px 2px 0;">風速</td><td style="text-align:right;">${t.wind_speed} · ${t.wind_deg}°</td></tr>
  </table>
</div>`;
}

/** 無人機圖示：使用 public/drone-marker.svg（OverlayView 內用同一張圖 + CSS filter 變色） */
const DRONE_ICON_URL = "/drone-marker.svg";
const DRONE_ICON_WIDTH = 88;
const DRONE_ICON_HEIGHT = 58;
/** 外層 div 多留空間給 drop-shadow，避免被地圖 overlay 裁切 */
const DRONE_ICON_OVERLAY_PADDING = 32;
const DRONE_ICON_OVERLAY_WIDTH = DRONE_ICON_WIDTH + DRONE_ICON_OVERLAY_PADDING * 2;
const DRONE_ICON_OVERLAY_HEIGHT = DRONE_ICON_HEIGHT + DRONE_ICON_OVERLAY_PADDING * 2;

const DRONE_PATH_OPACITY = 0.5;
const DRONE_PATH_WEIGHT = 4;

/** 地圖 overlay 外層 div 的 class：dark 主題與 active 由 index.css 對子元素 img 套 filter */
const DRONE_MARKER_DARK_CLASS = "drone-marker--dark";

/** 起點／終點 marker 圖示，顏色取自 --map-waypoint token */
const MAP_MARKER_FLAG_SVG_PATH =
  'M169.28 262.03c153.59 11.89 145.6-75.49 322.72-117.27C366.3 36.78 268.32 110.2 169.28 23.8v-2.79c0-11.6-9.41-21.01-21.01-21.01-11.6 0-21.01 9.41-21.01 21.01V399.3c0 11.6 9.41 21.01 21.01 21.01 11.6 0 21.01-9.41 21.01-21.01V262.03zm41.08 60.37c22.35 2.82 44.63 13.66 60.84 30 15.78 15.92 26.09 37 26.09 61.29 0 15.75-5.76 31.07-16.31 44.8-9.42 12.25-22.83 23.3-39.35 32.09-12.77 6.79-27.59 12.33-44.01 16.08-15.36 3.51-31.94 5.48-49.35 5.48-16.23 0-31.74-1.71-46.19-4.77-15.48-3.28-29.54-8.11-41.83-14.05C34 480.61 17.13 463.58 8.11 445.17c-7.83-15.99-9.77-32.84-6.77-48.96 2.88-15.55 10.38-30.1 21.55-42.15 14.79-15.94 36.28-27.68 62-31.31l4.07 37.3c-18.14 2.57-32.95 10.48-42.84 21.14-6.31 6.81-10.49 14.65-11.98 22.69-1.38 7.47-.41 15.43 3.37 23.15 5.59 11.42 17.15 22.52 35.99 31.64 10.26 4.96 21.95 8.98 34.75 11.7 12.19 2.58 25.61 4.02 40.02 4.02 15.47 0 29.79-1.65 42.66-4.6 13.63-3.11 25.89-7.68 36.4-13.27 12.28-6.53 21.92-14.33 28.32-22.66 5.2-6.77 8.04-13.69 8.04-20.17 0-12.74-5.85-24.24-14.8-33.27-11.06-11.15-26.52-18.58-42.2-20.56l3.67-37.46z';

function getOriginDestIconUrl(theme: Theme): string {
  const fill = readHexToken("map-waypoint", theme);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" shape-rendering="geometricPrecision" fill-rule="evenodd" clip-rule="evenodd" viewBox="0 0 492 512.14"><path fill="${fill}" d="${MAP_MARKER_FLAG_SVG_PATH}"/></svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

type Theme = "dark" | "light";

/** 供 ref 與呼叫端使用的 overlay 介面（實際類別在 Google 載入後才建立） */
export interface IDroneMarkerOverlay {
  setMap(map: google.maps.Map | null): void;
  setPosition(position: google.maps.LatLng): void;
  setTheme(theme: Theme): void;
  setTitle(title: string): void;
  setActive(active: boolean): void;
  getPosition(): google.maps.LatLng;
}

const DRONE_MARKER_ACTIVE_CLASS = "drone-marker--active";

let DroneMarkerOverlayClass: new (
  position: google.maps.LatLng,
  theme: Theme,
  onClick: () => void,
  title: string,
  onMouseEnter?: () => void,
  onMouseLeave?: () => void,
  onMounted?: () => void,
  isActive?: boolean
) => IDroneMarkerOverlay = null!;

/**
 * 在 Google Maps 載入後取得自訂 OverlayView 類別（延遲定義，避免 google is not defined）。
 */
function getDroneMarkerOverlayClass(): typeof DroneMarkerOverlayClass {
  if (DroneMarkerOverlayClass) return DroneMarkerOverlayClass;
  if (typeof google === "undefined" || !google.maps?.OverlayView) {
    throw new Error("Google Maps API not loaded");
  }
  class DroneMarkerOverlay extends google.maps.OverlayView implements IDroneMarkerOverlay {
    private position: google.maps.LatLng;
    private theme: Theme;
    private onClick: () => void;
    private title: string;
    private onMouseEnter?: () => void;
    private onMouseLeave?: () => void;
    private onMounted?: () => void;
    private isActive: boolean;
    private div: HTMLDivElement | null = null;
    private img: HTMLImageElement | null = null;

    constructor(
      position: google.maps.LatLng,
      theme: Theme,
      onClick: () => void,
      title: string,
      onMouseEnter?: () => void,
      onMouseLeave?: () => void,
      onMounted?: () => void,
      isActive: boolean = false
    ) {
      super();
      this.position = position;
      this.theme = theme;
      this.onClick = onClick;
      this.title = title;
      this.onMouseEnter = onMouseEnter;
      this.onMouseLeave = onMouseLeave;
      this.onMounted = onMounted;
      this.isActive = isActive;
    }

    onAdd(): void {
      const div = document.createElement("div");
      div.style.position = "absolute";
      div.style.cursor = "pointer";
      div.style.width = `${DRONE_ICON_OVERLAY_WIDTH}px`;
      div.style.height = `${DRONE_ICON_OVERLAY_HEIGHT}px`;
      div.style.left = "0";
      div.style.top = "0";
      div.style.pointerEvents = "auto";
      div.style.display = "flex";
      div.style.alignItems = "center";
      div.style.justifyContent = "center";
      div.title = this.title;
      if (this.theme === "dark") div.classList.add(DRONE_MARKER_DARK_CLASS);
      if (this.isActive) div.classList.add(DRONE_MARKER_ACTIVE_CLASS);

      const img = document.createElement("img");
      img.src = DRONE_ICON_URL;
      img.alt = "";
      img.style.width = `${DRONE_ICON_WIDTH}px`;
      img.style.height = `${DRONE_ICON_HEIGHT}px`;
      img.style.display = "block";
      img.style.objectFit = "contain";

      div.appendChild(img);
      div.addEventListener("click", (e) => {
        e.stopPropagation();
        this.onClick();
      });
      div.addEventListener("mouseenter", () => this.onMouseEnter?.());
      div.addEventListener("mouseleave", () => this.onMouseLeave?.());

      this.div = div;
      this.img = img;
      const panes = this.getPanes();
      if (panes?.overlayMouseTarget) {
        panes.overlayMouseTarget.appendChild(div);
      }
      this.onMounted?.();
    }

    draw(): void {
      if (!this.div || !this.position) return;
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(this.position);
      if (!point) return;
      const x = point.x - DRONE_ICON_OVERLAY_WIDTH / 2;
      const y = point.y - DRONE_ICON_OVERLAY_HEIGHT / 2;
      this.div.style.left = `${x}px`;
      this.div.style.top = `${y}px`;
    }

    onRemove(): void {
      if (this.div?.parentNode) {
        this.div.parentNode.removeChild(this.div);
      }
      this.div = null;
      this.img = null;
    }

    setPosition(position: google.maps.LatLng): void {
      this.position = position;
      this.draw();
    }

    setTheme(theme: Theme): void {
      if (this.theme === theme) return;
      this.theme = theme;
      if (this.div) {
        if (theme === "dark") this.div.classList.add(DRONE_MARKER_DARK_CLASS);
        else this.div.classList.remove(DRONE_MARKER_DARK_CLASS);
      }
    }

    setTitle(title: string): void {
      this.title = title;
      if (this.div) this.div.title = title;
    }

    setActive(active: boolean): void {
      if (this.isActive === active) return;
      this.isActive = active;
      if (this.div) {
        if (active) this.div.classList.add(DRONE_MARKER_ACTIVE_CLASS);
        else this.div.classList.remove(DRONE_MARKER_ACTIVE_CLASS);
      }
    }

    getPosition(): google.maps.LatLng {
      return this.position;
    }
  }
  DroneMarkerOverlayClass = DroneMarkerOverlay as typeof DroneMarkerOverlayClass;
  return DroneMarkerOverlayClass;
}

/** 模仿 Google Map：山＝綠（植被）＋淺咖啡（地形），水藍，陸地米色/深灰 */
const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a1a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9aa0a6" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#323338" }] },
  { featureType: "landscape.natural.terrain", elementType: "geometry", stylers: [{ color: "#4a4035" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#388e3c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#1a3a52" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#388e3c" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d3136" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1f2225" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#3c4043" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const LIGHT_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#5f6368" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f5f0e6" }] },
  { featureType: "landscape.natural.terrain", elementType: "geometry", stylers: [{ color: "#c4b896" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#c8e6c9" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#aad3df" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#c8e6c9" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#e0e0e0" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#fafafa" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const MAP_STYLES = { dark: DARK_MAP_STYLE, light: LIGHT_MAP_STYLE } as const;
const MAP_BG = { dark: "#323338", light: "#f5f0e6" } as const;

interface Props {
  telemetryByDrone: TelemetryByDrone;
  flightPathByDrone: FlightPathByDrone;
  selectedDroneId: number;
  isRunning: boolean;
  /** Legacy single-drone: when only one drone or backward compat */
  lat: number;
  lng: number;
  heading: number;
  flightPath: FlightPathPoint[];
  /** Optional history path from a past session to overlay on map */
  historyPath?: FlightPathPoint[] | null;
  /** Optional start/origin point to show a marker (e.g. user-confirmed address) */
  origin?: { lat: number; lng: number } | null;
  /** Optional destination point to show a marker (e.g. user-confirmed address) */
  destination?: { lat: number; lng: number } | null;
  /** Per-task assignments: show start/dest markers and lines for each (e.g. from task list) */
  taskAssignments?: Array<{
    start_lat: number;
    start_lng: number;
    dest_lat: number;
    dest_lng: number;
    drone_name?: string;
  }> | null;
  /** Optional explicit list of drone IDs to show (e.g. when idle, drones with last position) */
  droneIds?: number[];
  /** Last known position per drone when no live telemetry (e.g. after task ended) */
  lastPositionByDrone?: Record<number, { lat: number; lng: number }>;
  /** Called when user clicks a drone marker to set it as active */
  onDroneClick?: (droneId: number) => void;
  /** Called once when all drone markers have been mounted to the map DOM */
  onAllDroneMarkersMounted?: () => void;
}

export default function GoogleMapView({
  telemetryByDrone,
  flightPathByDrone,
  selectedDroneId,
  isRunning,
  lat,
  lng,
  heading,
  flightPath,
  historyPath,
  origin,
  destination,
  taskAssignments,
  droneIds: droneIdsProp,
  lastPositionByDrone,
  onDroneClick,
  onAllDroneMarkersMounted,
}: Props) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const overlaysRef = useRef<Record<number, IDroneMarkerOverlay>>({});
  const mountedCountRef = useRef(0);
  const expectedDroneCountRef = useRef(0);
  const allMountedNotifiedRef = useRef(false);
  const polylinesRef = useRef<Record<number, google.maps.Polyline>>({});
  const historyPolylineRef = useRef<google.maps.Polyline | null>(null);
  const originMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const taskAssignmentMarkersRef = useRef<google.maps.Marker[]>([]);
  const taskAssignmentLinesRef = useRef<google.maps.Polyline[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const infoWindowOpenForDroneIdRef = useRef<number | null>(null);
  const telemetryByDroneRef = useRef<TelemetryByDrone>({});
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const droneIdsFromTelemetry = Object.keys(telemetryByDrone).map(Number).sort((a, b) => a - b);
  const droneIds =
    droneIdsProp != null && droneIdsProp.length > 0
      ? droneIdsProp
      : droneIdsFromTelemetry;

  useEffect(() => {
    let timeoutId: number | undefined;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        queueMicrotask(() => {
          const container = containerRef.current;
          if (cancelled || !container || !container.isConnected || mapRef.current) return;
          // 建立地圖時用與 ThemeContext 一致的 stored theme，避免重新整理後
          // React state 尚未從 localStorage 還原時地圖仍用預設 dark 的問題
          const initialTheme = getStoredTheme();

          const map = new google.maps.Map(container, {
            center: { lat, lng },
            zoom: 15,
            styles: MAP_STYLES[initialTheme],
            disableDefaultUI: true,
            zoomControl: true,
            backgroundColor: MAP_BG[initialTheme],
          });

          if (cancelled) return;
          mapRef.current = map;
          infoWindowRef.current = new google.maps.InfoWindow({ disableAutoPan: true });

          resizeObserverRef.current = new ResizeObserver(() => {
            if (mapRef.current && typeof google !== "undefined" && google.maps?.event) {
              google.maps.event.trigger(mapRef.current, "resize");
            }
          });
          resizeObserverRef.current.observe(container);

          timeoutId = window.setTimeout(() => {
            if (cancelled || !mapRef.current) return;
            if (typeof google !== "undefined" && google.maps?.event) {
              google.maps.event.trigger(mapRef.current, "resize");
            }
            mapRef.current.setCenter({ lat, lng });
          }, 150);
        });
      })
      .catch(() => {
        // show placeholder if key missing or load fail
      });

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = undefined;
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setOptions({ styles: MAP_STYLES[theme], backgroundColor: MAP_BG[theme] });
  }, [theme]);

  // 無無人機時讓地圖中心跟隨傳入的 lat/lng（例如 refresh 後 userLocation 取得時置中到目前位置）
  useEffect(() => {
    if (!mapRef.current || droneIds.length > 0) return;
    mapRef.current.setCenter({ lat, lng });
  }, [lat, lng, droneIds.length]);

  // 開始任務後觸發地圖 resize 並置中（ResizeObserver 會處理尺寸變動，這裡再強制一次）
  const prevRunningRef = useRef(false);
  useEffect(() => {
    let timeoutId: number | undefined;
    const justStarted = isRunning && !prevRunningRef.current;
    prevRunningRef.current = isRunning;
    if (!mapRef.current || !justStarted) return;
    const map = mapRef.current;
    const first = droneIds[0];
    const firstT = first !== undefined ? telemetryByDrone[first] : undefined;
    const firstLast = first !== undefined ? lastPositionByDrone?.[first] : undefined;
    const centerLat = firstT?.lat ?? firstLast?.lat ?? lat;
    const centerLng = firstT?.lng ?? firstLast?.lng ?? lng;
    const clat = centerLat ?? lat;
    const clng = centerLng ?? lng;
    const triggerResizeAndCenter = () => {
      if (typeof google !== "undefined" && google.maps?.event) {
        google.maps.event.trigger(map, "resize");
      }
      map.setCenter({ lat: clat, lng: clng });
    };
    const rafId = requestAnimationFrame(() => {
      triggerResizeAndCenter();
      timeoutId = window.setTimeout(triggerResizeAndCenter, 200);
    });
    return () => {
      cancelAnimationFrame(rafId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [isRunning, droneIds, telemetryByDrone, lastPositionByDrone, lat, lng]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    telemetryByDroneRef.current = telemetryByDrone;
    const pathColor = readColorToken("map-route-active", theme);

    for (const id of Object.keys(overlaysRef.current).map(Number)) {
      const shouldRemove = !droneIds.includes(id);
      if (shouldRemove) {
        const overlay = overlaysRef.current[id];
        if (overlay) overlay.setMap(null);
        polylinesRef.current[id]?.setMap(null);
        delete overlaysRef.current[id];
        delete polylinesRef.current[id];
      }
    }

    const idsToCreate = droneIds.filter((id) => !overlaysRef.current[id]);
    expectedDroneCountRef.current = idsToCreate.length;
    mountedCountRef.current = 0;

    droneIds.forEach((id) => {
      const t = telemetryByDrone[id];
      const lastPos = lastPositionByDrone?.[id];
      const position =
        t != null
          ? { lat: t.lat, lng: t.lng }
          : lastPos != null
            ? lastPos
            : null;
      if (position == null) return;

      const path = flightPathByDrone[id] ?? [];

      if (!overlaysRef.current[id]) {
        const pos = new google.maps.LatLng(position.lat, position.lng);
        const OverlayClass = getDroneMarkerOverlayClass();
        const onMounted = () => {
          mountedCountRef.current += 1;
          if (
            !allMountedNotifiedRef.current &&
            mountedCountRef.current === expectedDroneCountRef.current &&
            expectedDroneCountRef.current > 0
          ) {
            allMountedNotifiedRef.current = true;
            onAllDroneMarkersMounted?.();
          }
        };
        const overlay = new OverlayClass(
          pos,
          theme,
          () => {
            onDroneClick?.(id);
          },
          "",
          undefined,
          undefined,
          onMounted,
          id === selectedDroneId
        );
        overlay.setMap(map);
        overlaysRef.current[id] = overlay;
        polylinesRef.current[id] = new google.maps.Polyline({
          path: path.map((p) => ({ lat: p.lat, lng: p.lng })),
          geodesic: true,
          strokeColor: pathColor,
          strokeOpacity: DRONE_PATH_OPACITY,
          strokeWeight: DRONE_PATH_WEIGHT,
          map,
        });
      } else {
        const overlay = overlaysRef.current[id];
        overlay.setPosition(new google.maps.LatLng(position.lat, position.lng));
        overlay.setTheme(theme);
        overlay.setTitle("");
        overlay.setActive(id === selectedDroneId);
        polylinesRef.current[id].setPath(path.map((p) => ({ lat: p.lat, lng: p.lng })));
        polylinesRef.current[id].setOptions({ strokeColor: pathColor });
      }
    });
  }, [
    telemetryByDrone,
    flightPathByDrone,
    selectedDroneId,
    isRunning,
    droneIds.join(","),
    lastPositionByDrone,
    theme,
    onDroneClick,
    onAllDroneMarkersMounted,
  ]);

  // When selection changes, close InfoWindow so only the card below shows the selected drone.
  useEffect(() => {
    const infoWindow = infoWindowRef.current;
    if (!infoWindow) return;
    if (infoWindowOpenForDroneIdRef.current !== null) {
      infoWindow.close();
      infoWindowOpenForDroneIdRef.current = null;
    }
  }, [selectedDroneId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!historyPath || historyPath.length === 0) {
      historyPolylineRef.current?.setMap(null);
      historyPolylineRef.current = null;
      return;
    }
    const strokeColor = readColorToken("map-route-history", theme);
    if (!historyPolylineRef.current) {
      historyPolylineRef.current = new google.maps.Polyline({
        path: historyPath.map((p) => ({ lat: p.lat, lng: p.lng })),
        geodesic: true,
        strokeColor,
        strokeOpacity: 0.7,
        strokeWeight: 2,
        map,
      });
    } else {
      historyPolylineRef.current.setPath(historyPath.map((p) => ({ lat: p.lat, lng: p.lng })));
      historyPolylineRef.current.setOptions({ strokeColor });
      historyPolylineRef.current.setMap(map);
    }
  }, [historyPath, theme]);

  // 起點 marker：使用者確認地址或使用目前位置後顯示
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof google === "undefined" || !google.maps?.Marker) return;
    if (!origin) {
      originMarkerRef.current?.setMap(null);
      originMarkerRef.current = null;
      return;
    }
    const pos = { lat: origin.lat, lng: origin.lng };
    const iconUrl = getOriginDestIconUrl(theme);
    const size = 48;
    const anchorY = 50; // pin 尖端對齊座標點
    const iconConfig = {
      url: iconUrl,
      scaledSize: new google.maps.Size(size, Math.round((size * 512) / 492)),
      anchor: new google.maps.Point(size / 2, anchorY),
    };
    if (!originMarkerRef.current) {
      originMarkerRef.current = new google.maps.Marker({
        position: pos,
        map,
        title: "起點",
        icon: iconConfig,
      });
    } else {
      originMarkerRef.current.setPosition(pos);
      originMarkerRef.current.setIcon(iconConfig);
      originMarkerRef.current.setMap(map);
    }
  }, [origin, theme]);

  // 終點 marker：使用者確認地址後顯示（較大）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof google === "undefined" || !google.maps?.Marker) return;
    if (!destination) {
      destinationMarkerRef.current?.setMap(null);
      destinationMarkerRef.current = null;
      return;
    }
    const pos = { lat: destination.lat, lng: destination.lng };
    const iconUrl = getOriginDestIconUrl(theme);
    const size = 56;
    const anchorY = Math.round((size * 512) / 492); // pin 尖端對齊座標點
    const iconConfig = {
      url: iconUrl,
      scaledSize: new google.maps.Size(size, anchorY),
      anchor: new google.maps.Point(size / 2, anchorY),
    };
    if (!destinationMarkerRef.current) {
      destinationMarkerRef.current = new google.maps.Marker({
        position: pos,
        map,
        title: "終點",
        icon: iconConfig,
      });
    } else {
      destinationMarkerRef.current.setPosition(pos);
      destinationMarkerRef.current.setIcon(iconConfig);
      destinationMarkerRef.current.setMap(map);
    }
  }, [destination, theme]);

  // 多任務指派：每個指派顯示起點、終點與連線（僅在無單一 origin/destination 時不衝突，可並存）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || typeof google === "undefined" || !google.maps?.Marker) return;
    taskAssignmentMarkersRef.current.forEach((m) => m.setMap(null));
    taskAssignmentMarkersRef.current = [];
    taskAssignmentLinesRef.current.forEach((p) => p.setMap(null));
    taskAssignmentLinesRef.current = [];
    if (!taskAssignments || taskAssignments.length === 0) return;
    const taskIconUrl = getOriginDestIconUrl(theme);
    const size = 32;
    const anchorY = Math.round((size * 512) / 492);
    const taskIconConfig = {
      url: taskIconUrl,
      scaledSize: new google.maps.Size(size, anchorY),
      anchor: new google.maps.Point(size / 2, anchorY),
    };
    for (const a of taskAssignments) {
      const startM = new google.maps.Marker({
        position: { lat: a.start_lat, lng: a.start_lng },
        map,
        title: a.drone_name ? `${a.drone_name} 起點` : "起點",
        icon: taskIconConfig,
      });
      const destM = new google.maps.Marker({
        position: { lat: a.dest_lat, lng: a.dest_lng },
        map,
        title: a.drone_name ? `${a.drone_name} 終點` : "終點",
        icon: taskIconConfig,
      });
      taskAssignmentMarkersRef.current.push(startM, destM);
      const line = new google.maps.Polyline({
        path: [
          { lat: a.start_lat, lng: a.start_lng },
          { lat: a.dest_lat, lng: a.dest_lng },
        ],
        geodesic: true,
        strokeColor: readColorToken("map-route-planned", theme),
        strokeOpacity: 0.5,
        strokeWeight: 2,
        map,
      });
      taskAssignmentLinesRef.current.push(line);
    }
  }, [taskAssignments, theme]);

  if (droneIds.length === 0 && lat !== undefined && lng !== undefined) {
    const map = mapRef.current;
    if (map) {
      telemetryByDroneRef.current = telemetryByDrone;
      const legacyT = telemetryByDrone[0];
      const pathColor = readColorToken("map-route-active", themeRef.current);
      if (overlaysRef.current[0] === undefined) {
        expectedDroneCountRef.current = 1;
        mountedCountRef.current = 0;
        const onMounted = () => {
          mountedCountRef.current += 1;
          if (
            !allMountedNotifiedRef.current &&
            mountedCountRef.current === expectedDroneCountRef.current &&
            expectedDroneCountRef.current > 0
          ) {
            allMountedNotifiedRef.current = true;
            onAllDroneMarkersMounted?.();
          }
        };
        const position = new google.maps.LatLng(lat, lng);
        const OverlayClass = getDroneMarkerOverlayClass();
        const overlay = new OverlayClass(
          position,
          themeRef.current,
          () => {
            onDroneClick?.(0);
            const current = telemetryByDroneRef.current[0];
            const infoWindow = infoWindowRef.current;
            if (infoWindow && current) {
              infoWindow.setContent(
                buildDroneInfoContent(current, 0, themeRef.current)
              );
              infoWindow.setPosition({ lat: current.lat, lng: current.lng });
              infoWindow.open(map);
              infoWindowOpenForDroneIdRef.current = 0;
            }
          },
          "",
          undefined,
          undefined,
          onMounted
        );
        overlay.setMap(map);
        overlaysRef.current[0] = overlay;
        polylinesRef.current[0] = new google.maps.Polyline({
          path: flightPath.map((p) => ({ lat: p.lat, lng: p.lng })),
          geodesic: true,
          strokeColor: pathColor,
          strokeOpacity: DRONE_PATH_OPACITY,
          strokeWeight: DRONE_PATH_WEIGHT,
          map,
        });
      }
      if (overlaysRef.current[0]) {
        overlaysRef.current[0].setPosition(new google.maps.LatLng(lat, lng));
        overlaysRef.current[0].setTitle("");
        overlaysRef.current[0].setTheme(themeRef.current);
        polylinesRef.current[0]?.setPath(flightPath.map((p) => ({ lat: p.lat, lng: p.lng })));
        polylinesRef.current[0]?.setOptions({ strokeColor: pathColor });
      }
    }
  }

  const hasKey = Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  if (!hasKey) {
    return (
      <div className="flex w-full h-full items-center justify-center panel text-muted-foreground text-sm">
        請設定 VITE_GOOGLE_MAPS_API_KEY 以顯示地圖
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-[280px] w-full h-full rounded-lg border border-border shadow-raised"
    />
  );
}
