import { useTranslation } from "react-i18next";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { RotateCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Full-width notice shown while the backend can't be reached. */
export default function BackendStatusBanner() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fetching = useIsFetching() > 0;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-warning-border bg-warning-subtle px-5 py-2 text-warning-text"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 text-xs">
        <span className="font-semibold">{t("backend.unreachableTitle")}</span>{" "}
        <span>{t("backend.unreachableHint")}</span>
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 gap-1.5 px-2 text-xs text-warning-text hover:bg-warning-border/40 hover:text-warning-text"
        onClick={() => queryClient.refetchQueries({ type: "active" })}
        disabled={fetching}
      >
        <RotateCw className={fetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden />
        {t("common.retry")}
      </Button>
    </div>
  );
}
