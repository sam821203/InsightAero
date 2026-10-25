import type { ComponentProps } from "react";
import GoogleMapView from "@/components/google-map-view";
import {
  liveDroneIdsOf,
  selectActivePath,
  selectActiveTelemetry,
  useTelemetryStore,
} from "@/stores/telemetry-store";

type LiveProps =
  | "telemetryByDrone"
  | "flightPathByDrone"
  | "selectedDroneId"
  | "lat"
  | "lng"
  | "heading"
  | "flightPath"
  | "onDroneClick";

type Props = Omit<ComponentProps<typeof GoogleMapView>, LiveProps> & {
  /** Where to center the map when no drone is sending telemetry. */
  fallbackCenter: { lat: number; lng: number };
};

const EMPTY_PATH: never[] = [];

/**
 * Connects GoogleMapView to the telemetry store. Only this wrapper and the
 * map re-render on each packet; the page around them does not.
 */
export default function LiveMapView({ fallbackCenter, ...mapProps }: Props) {
  const telemetryByDrone = useTelemetryStore((s) => s.byDrone);
  const flightPathByDrone = useTelemetryStore((s) => s.pathByDrone);
  const selectedDroneId = useTelemetryStore((s) => s.selectedDroneId);
  const selectDrone = useTelemetryStore((s) => s.selectDrone);
  const active = useTelemetryStore(selectActiveTelemetry);
  const activePath = useTelemetryStore(selectActivePath) ?? EMPTY_PATH;

  const hasLive = liveDroneIdsOf(telemetryByDrone).length > 0;
  const center = hasLive ? { lat: active.lat, lng: active.lng } : fallbackCenter;

  return (
    <GoogleMapView
      {...mapProps}
      telemetryByDrone={telemetryByDrone}
      flightPathByDrone={flightPathByDrone}
      selectedDroneId={selectedDroneId}
      lat={center.lat}
      lng={center.lng}
      heading={active.heading}
      flightPath={activePath}
      onDroneClick={selectDrone}
    />
  );
}
