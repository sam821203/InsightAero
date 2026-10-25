import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const MIN_WIDTH = 260;
const MAX_WIDTH = 560;
const DEFAULT_WIDTH = 400;

const clampWidth = (width: number) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));

interface ResizableSidebarProps {
  label: string;
  children: ReactNode;
}

/** Right-hand sidebar with a drag handle on its left edge. Only this component uses the width, so it is local state. */
export default function ResizableSidebar({ label, children }: ResizableSidebarProps) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    // The sidebar is on the right edge, so its width is the distance from the cursor to the window edge.
    const onMove = (e: MouseEvent) => setWidth(clampWidth(window.innerWidth - e.clientX));
    const onUp = () => setIsResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  return (
    <aside
      aria-label={label}
      className="relative flex shrink-0 flex-col border-l border-border p-3"
      style={{ width }}
    >
      <button
        type="button"
        aria-label={t("app.resizeSidebar")}
        onMouseDown={startResize}
        className={cn(
          "absolute bottom-0 left-0 top-0 z-10 w-1 -translate-x-1/2 cursor-col-resize touch-none transition-colors hover:bg-primary/20",
          isResizing && "bg-primary/40"
        )}
      />
      {children}
    </aside>
  );
}
