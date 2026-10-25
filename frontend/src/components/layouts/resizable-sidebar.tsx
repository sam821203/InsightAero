import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useUIStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

interface ResizableSidebarProps {
  label: string;
  children: ReactNode;
}

/** Right-hand sidebar with a drag handle on its left edge. Width lives in uiStore. */
export default function ResizableSidebar({ label, children }: ResizableSidebarProps) {
  const { t } = useTranslation();
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const resizeSidebar = useUIStore((s) => s.resizeSidebar);
  const [isResizing, setIsResizing] = useState(false);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const onMove = (e: MouseEvent) => resizeSidebar(e.clientX);
    const onUp = () => setIsResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, resizeSidebar]);

  return (
    <aside
      aria-label={label}
      className="relative flex shrink-0 flex-col border-l border-border p-3"
      style={{ width: sidebarWidth }}
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
