import { useTranslation } from "react-i18next";
import { useTelemetryStore, type ConnectionState } from "@/stores/telemetry-store";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const LOOK: Record<ConnectionState, { tone: BadgeTone; dot: true | "pulse" }> = {
  connecting: { tone: "neutral", dot: "pulse" },
  open: { tone: "success", dot: true },
  reconnecting: { tone: "warning", dot: "pulse" },
};

/** Header badge for the live telemetry link. */
export default function ConnectionIndicator() {
  const { t } = useTranslation();
  const connection = useTelemetryStore((s) => s.connection);
  const look = LOOK[connection];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span role="status" tabIndex={0} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Badge tone={look.tone} dot={look.dot}>
            {t(`connection.${connection}`)}
          </Badge>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[240px]">
        {t(`connection.${connection}Hint`)}
      </TooltipContent>
    </Tooltip>
  );
}
