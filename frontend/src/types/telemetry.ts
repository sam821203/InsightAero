/** 與後端 /ws/telemetry 推播格式一致 */
export interface TelemetryPacket {
  lat: number;
  lng: number;
  alt: number;
  heading: number;
  speed: number;
  battery: number;
  wind_speed: number;
  wind_deg: number;
  effective_speed_m_min: number;
  timestamp: number;
  /** 多機時由後端帶上 */
  drone_id?: number;
  session_id?: number;
}

export interface FlightPathPoint {
  lat: number;
  lng: number;
}

/** 依 drone_id 分組的即時遙測 */
export type TelemetryByDrone = Record<number, TelemetryPacket>;

/** 依 drone_id 分組的軌跡 */
export type FlightPathByDrone = Record<number, FlightPathPoint[]>;
