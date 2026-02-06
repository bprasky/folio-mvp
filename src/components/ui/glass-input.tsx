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
          "bg-gray-50/50",
          "border rounded-xl",
          error ? "border-red-300" : "border-gray-200/70",
          "text-base text-gray-900",
          "placeholder:text-gray-400",
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

