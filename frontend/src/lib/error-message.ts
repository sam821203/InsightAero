import type { TFunction } from "i18next";
import type { ApiError } from "@/api/client";

/** A short, human message for a failed request. Prefers the backend's own detail. */
export function errorMessage(error: unknown, t: TFunction): string {
  const err = error as ApiError | null;
  if (err?.unreachable) return t("errors.unreachable");
  if (err?.detail) return err.detail;
  if (err?.status) return t("errors.http", { status: err.status });
  return t("errors.unknown");
}
