import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

/** Full-screen loading overlay for the first paint. */
export default function PageLoader() {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin" aria-hidden />
        <span className="text-sm">{t("common.loading")}</span>
      </div>
    </div>
  );
}
