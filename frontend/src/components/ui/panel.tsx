import * as React from "react";
import { cn } from "@/lib/utils";

const Panel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border border-border bg-card text-card-foreground shadow-raised", className)}
      {...props}
    />
  )
);
Panel.displayName = "Panel";

const PanelHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2.5", className)}
      {...props}
    />
  )
);
PanelHeader.displayName = "PanelHeader";

type PanelTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  as?: "h2" | "h3" | "span";
};

const PanelTitle = React.forwardRef<HTMLHeadingElement, PanelTitleProps>(
  ({ className, as: Comp = "h3", ...props }, ref) => (
    <Comp
      ref={ref}
      className={cn("text-sm font-semibold leading-tight tracking-tight text-foreground", className)}
      {...props}
    />
  )
);
PanelTitle.displayName = "PanelTitle";

export { Panel, PanelHeader, PanelTitle };
