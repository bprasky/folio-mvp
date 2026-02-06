import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface GlassInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full px-4 py-3",
          "bg-[var(--bg-elevated)]/50",
          "border rounded-xl",
          error ? "border-red-300" : "border-[var(--ridge-outer)]/70",
          "text-base text-[var(--text-primary)]",
          "placeholder:text-[var(--text-tertiary)]",
          "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)]/50",
          "transition-colors",
          className
        )}
        {...props}
      />
    );
  }
);

GlassInput.displayName = "GlassInput";

export { GlassInput };
export type { GlassInputProps };

