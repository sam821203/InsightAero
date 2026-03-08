import { apiFetch } from "./client";

export interface DiagnoseResponse {
  diagnosis: string;
}

/** 依 session 取得診斷（後端會從 DB 取該場次遙測）。 */
export async function diagnoseSession(sessionId: number): Promise<DiagnoseResponse> {
  return apiFetch<DiagnoseResponse>(
    `/api/flight-sessions/${sessionId}/diagnose`,
    { method: "POST" }
  );
}

/** 依單筆或多筆遙測 snapshot 取得診斷（無 session 時使用）。 */
export async function diagnoseTelemetry(
  telemetry: Record<string, number>[]
): Promise<DiagnoseResponse> {
  return apiFetch<DiagnoseResponse>("/api/diagnose", {
    method: "POST",
    body: JSON.stringify({ telemetry }),
  });
}
