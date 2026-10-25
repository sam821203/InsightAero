import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2 } from "lucide-react";
import DestinationAddressInput from "@/components/DestinationAddressInput";
import { geocodeAddress } from "@/utils/geocode";
import type { TaskCreateBody, TaskCreateAssignmentInput } from "@/types/task";
import { useDrones } from "@/hooks/useDrones";
import { Input, NativeSelect } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import type { Messages } from "@/locales/types";

/* Store the key, not translated text, so the message follows a language switch. */
type FormError = { key: keyof Messages["taskForm"]["errors"] } | { message: string };

export interface TaskCreateFormProps {
  /** 建議起點（可選，例如上一任務終點），用於需要填起點時預填或提示 */
  effectiveStart: { lat: number; lng: number } | null;
  onCreate: (body: TaskCreateBody) => Promise<unknown>;
  onSuccess?: () => void;
  onAddressError?: () => void;
  /** 已被其他進行中任務占用的無人機 ID，這些無人機不顯示於指派選單 */
  excludeDroneIds?: Set<number>;
}

function makeAssignment(
  droneId: number,
  start: { lat: number; lng: number },
  dest: { lat: number; lng: number }
): TaskCreateAssignmentInput {
  return {
    drone_id: droneId,
    start_lat: start.lat,
    start_lng: start.lng,
    dest_lat: dest.lat,
    dest_lng: dest.lng,
  };
}

export default function TaskCreateForm({
  effectiveStart,
  onCreate,
  onSuccess,
  onAddressError,
  excludeDroneIds,
}: TaskCreateFormProps) {
  const { t } = useTranslation();
  // Shared cache: stays in sync with the fleet list and the map without refetching here.
  const { drones } = useDrones();
  const [name, setName] = useState("");
  const [droneIds, setDroneIds] = useState<number[]>([0]);

  const [startInput, setStartInput] = useState("");
  const [confirmedStart, setConfirmedStart] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocatingStart, setIsLocatingStart] = useState(false);

  const [destinationInput, setDestinationInput] = useState("");
  const [confirmedDestination, setConfirmedDestination] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [isLocatingDestination, setIsLocatingDestination] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<FormError | null>(null);

  const idleDrones = drones.filter((d) => d.status === "idle");
  const exclude = excludeDroneIds ?? new Set<number>();
  const assignableDrones = idleDrones.filter((d) => !exclude.has(d.id));
  const validDroneIds = droneIds.filter((id) => id > 0);
  const needStartInput = validDroneIds.some((id) => {
    const d = drones.find((dr) => dr.id === id);
    return d != null && (d.last_lat == null || d.last_lng == null);
  });
  /** 終點可填寫條件：已選無人機，且若需起點則起點已填寫 */
  const destinationEnabled =
    validDroneIds.length > 0 && (!needStartInput || confirmedStart != null);

  const removeRow = (index: number) =>
    setDroneIds((prev) => prev.filter((_, i) => i !== index));
  const updateDroneId = (index: number, id: number) =>
    setDroneIds((prev) => prev.map((v, i) => (i === index ? id : v)));

  const handleLocateStart = useCallback(async () => {
    const value = startInput.trim();
    if (!value) return;
    setIsLocatingStart(true);
    try {
      const coords = await geocodeAddress(value);
      if (coords) {
        setConfirmedStart(coords);
        setStartInput(value);
      } else {
        onAddressError?.();
      }
    } finally {
      setIsLocatingStart(false);
    }
  }, [startInput, onAddressError]);

  const handleLocateDestination = useCallback(async () => {
    const value = destinationInput.trim();
    if (!value) return;
    setIsLocatingDestination(true);
    try {
      const coords = await geocodeAddress(value);
      if (coords) {
        setConfirmedDestination(coords);
        setDestinationInput(value);
      } else {
        onAddressError?.();
      }
    } finally {
      setIsLocatingDestination(false);
    }
  }, [destinationInput, onAddressError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (validDroneIds.length === 0) {
      setError({ key: "noDrone" });
      return;
    }
    if (needStartInput && !confirmedStart) {
      setError({ key: "noStart" });
      return;
    }
    if (!confirmedDestination) {
      setError({ key: "noDestination" });
      return;
    }

    const assignments: TaskCreateAssignmentInput[] = [];
    for (const drone_id of validDroneIds) {
      const d = drones.find((dr) => dr.id === drone_id);
      const start =
        d != null && d.last_lat != null && d.last_lng != null
          ? { lat: d.last_lat, lng: d.last_lng }
          : confirmedStart;
      if (!start) {
        setError({ key: "startMissing" });
        return;
      }
      assignments.push(makeAssignment(drone_id, start, confirmedDestination!));
    }

    setSubmitting(true);
    try {
      const body: TaskCreateBody = { name: name.trim() || undefined, assignments };
      const result = await onCreate(body);
      if (result != null) {
        setName("");
        setDroneIds([0]);
        setDestinationInput("");
        setConfirmedDestination(null);
        if (needStartInput) {
          setStartInput("");
          setConfirmedStart(null);
        }
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? { message: err.message } : { key: "createFailed" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-[11px] text-muted-foreground">{t("taskForm.nameLabel")}</label>
        <Input
          size="sm"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("taskForm.namePlaceholder")}
          className="mt-0.5"
        />
      </div>

      {/* 指派無人機（先選，再依所選決定是否需填起點） */}
      <div className="space-y-2">
        <label className="text-[11px] text-muted-foreground block">{t("taskForm.dronesLabel")}</label>
        {droneIds.map((droneId, index) => (
          <div
            key={index}
            className="flex items-center gap-2 text-[11px]"
          >
            <NativeSelect
              value={droneId || ""}
              onChange={(e) => updateDroneId(index, Number(e.target.value))}
              size="sm"
              className="flex-1"
            >
              <option value="">{t("taskForm.selectDrone")}</option>
              {assignableDrones.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
            {droneIds.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => removeRow(index)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* 起點：依所選無人機是否有上次終止位置決定是否顯示輸入 */}
      {validDroneIds.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{t("taskForm.selectDroneFirst")}</p>
      ) : needStartInput ? (
        <div className="space-y-1.5">
          <label className="text-[11px] text-muted-foreground">{t("taskForm.startLabel")}</label>
          <p className="text-[11px] text-muted-foreground">
            {t("taskForm.startHint")}
          </p>
          <div className="flex gap-2 items-center">
            <DestinationAddressInput
              value={startInput}
              onChange={(v) => {
                setStartInput(v);
                setConfirmedStart(null);
              }}
              onPlaceSelect={(result) => {
                setStartInput(result.formattedAddress);
                setConfirmedStart({ lat: result.lat, lng: result.lng });
              }}
              placeholder={t("taskForm.startPlaceholder")}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleLocateStart}
              disabled={isLocatingStart || !startInput.trim()}
              className="shrink-0 text-xs"
            >
              {isLocatingStart ? t("common.locating") : t("common.locate")}
            </Button>
          </div>
          {confirmedStart && startInput && (
            <p className="text-[11px] text-muted-foreground truncate" title={startInput}>
              {t("taskForm.startConfirmed", { address: startInput })}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-0.5">
          <span className="text-[11px] text-muted-foreground">{t("taskForm.startShort")}</span>
          <p className="text-[11px] text-foreground">{t("taskForm.startFromLastPosition")}</p>
        </div>
      )}

      {/* 終點地址：須先選無人機且起點（若需要）已填寫後才可填 */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-muted-foreground">{t("taskForm.destinationLabel")}</label>
        {!destinationEnabled ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex w-full gap-2 items-center cursor-not-allowed">
                <DestinationAddressInput
                  value={destinationInput}
                  onChange={(v) => {
                    setDestinationInput(v);
                    setConfirmedDestination(null);
                  }}
                  onPlaceSelect={(result) => {
                    setDestinationInput(result.formattedAddress);
                    setConfirmedDestination({ lat: result.lat, lng: result.lng });
                  }}
                  placeholder={t("taskForm.destinationPlaceholder")}
                  disabled
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled
                  className="shrink-0 text-xs"
                >
                  {t("common.locate")}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[220px]">
              {t("taskForm.destinationDisabledHint")}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div className="flex gap-2 items-center">
            <DestinationAddressInput
              value={destinationInput}
              onChange={(v) => {
                setDestinationInput(v);
                setConfirmedDestination(null);
              }}
              onPlaceSelect={(result) => {
                setDestinationInput(result.formattedAddress);
                setConfirmedDestination({ lat: result.lat, lng: result.lng });
              }}
              placeholder={t("taskForm.destinationPlaceholder")}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleLocateDestination}
              disabled={isLocatingDestination || !destinationInput.trim()}
              className="shrink-0 text-xs"
            >
              {isLocatingDestination ? t("common.locating") : t("common.locate")}
            </Button>
          </div>
        )}
        {confirmedDestination && destinationInput && (
          <p className="text-[11px] text-muted-foreground truncate" title={destinationInput}>
            {t("taskForm.destinationConfirmed", { address: destinationInput })}
          </p>
        )}
      </div>

      {error && (
        <p className="text-[11px] text-destructive-text">
          {"key" in error ? t(`taskForm.errors.${error.key}`) : error.message}
        </p>
      )}
      <Button
        type="submit"
        className="w-full"
        disabled={
          submitting ||
          assignableDrones.length === 0 ||
          validDroneIds.length === 0 ||
          !confirmedDestination ||
          (needStartInput && !confirmedStart)
        }
      >
        {submitting ? t("taskForm.submitting") : t("taskForm.submit")}
      </Button>
    </form>
  );
}
