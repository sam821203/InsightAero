import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errorMessage";

/** Placeholder rows shaped like list items, shown while a list loads for the first time. */
export function ListLoading({ rows = 3, label }: { rows?: number; label?: string }) {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={label ?? t("common.loading")} className="space-y-2 p-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="space-y-2 rounded-md border border-border-subtle p-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="h-3 w-2/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-3 w-14 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
          </div>
          <div className="h-2.5 w-3/5 animate-pulse rounded bg-muted motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}

export function ListEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ListError({
  title,
  error,
  onRetry,
  retrying,
}: {
  title: string;
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive-subtle text-destructive-text">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">{errorMessage(error, t)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4 h-7 gap-1.5 text-xs" onClick={onRetry} disabled={retrying}>
          <RotateCw className={retrying ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden />
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
