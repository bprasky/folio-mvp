import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface GlassTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

const GlassTextarea = forwardRef<HTMLTextAreaElement, GlassTextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full px-4 py-3",
          "min-h-[120px]",
          "bg-gray-50/50",
          "border rounded-xl",
          error ? "border-red-300" : "border-gray-200/70",
          "text-base text-gray-900 leading-relaxed",
          "placeholder:text-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/50",
          "resize-y",
          "transition-colors",
          className
        )}
        {...props}
      />
    );
  }
);

GlassTextarea.displayName = "GlassTextarea";

export { GlassTextarea };
export type { GlassTextareaProps };

