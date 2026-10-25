import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-px text-[11px] font-medium leading-4",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        info: "border-info-border bg-info-subtle text-info-text",
        success: "border-success-border bg-success-subtle text-success-text",
        warning: "border-warning-border bg-warning-subtle text-warning-text",
        danger: "border-destructive-border bg-destructive-subtle text-destructive-text",
      },
    },
    defaultVariants: { tone: "neutral" },
  }
);

const dotVariants = cva("h-1.5 w-1.5 shrink-0 rounded-full", {
  variants: {
    tone: {
      neutral: "bg-subtle-foreground",
      info: "bg-info",
      success: "bg-success",
      warning: "bg-warning",
      danger: "bg-destructive",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Leading dot; `pulse` animates it for states that are in progress. */
  dot?: boolean | "pulse";
}

function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && (
        <span
          aria-hidden
          className={cn(dotVariants({ tone }), dot === "pulse" && "animate-pulse motion-reduce:animate-none")}
        />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
