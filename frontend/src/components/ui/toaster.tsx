import { Toaster as Sonner } from "sonner";
import { useTheme } from "@/contexts/use-theme";

/** App-wide toast outlet, styled with the semantic tokens and following the theme. */
export function Toaster() {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group !rounded-lg !border !border-border !bg-popover !text-popover-foreground !shadow-overlay",
          title: "!text-sm !font-medium",
          description: "!text-xs !text-muted-foreground",
          error: "[&_[data-icon]]:!text-destructive-text",
          success: "[&_[data-icon]]:!text-success-text",
          closeButton: "!border-border !bg-popover !text-muted-foreground",
        },
      }}
    />
  );
}
