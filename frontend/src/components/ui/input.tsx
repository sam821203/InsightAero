import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const inputVariants = cva(
  "w-full rounded-md border border-input bg-surface-sunken text-foreground transition-colors placeholder:text-subtle-foreground enabled:hover:border-border-strong focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      size: {
        default: "h-9 px-3 text-sm",
        sm: "h-7 px-2 text-xs",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, size, ...props }, ref) => (
  <input ref={ref} className={cn(inputVariants({ size }), className)} {...props} />
));
Input.displayName = "Input";

export interface NativeSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">,
    VariantProps<typeof inputVariants> {}

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, size, ...props }, ref) => (
    <select ref={ref} className={cn(inputVariants({ size }), className)} {...props} />
  )
);
NativeSelect.displayName = "NativeSelect";

export { Input, NativeSelect, inputVariants };
