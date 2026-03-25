import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "subtle" | "strong" | "solid";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  rounded?: "lg" | "xl" | "2xl" | "3xl";
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = "default", padding = "md", rounded = "2xl", children, ...props }, ref) => {
    
    const variants = {
      default: "glass-surface",
      subtle: "glass-surface-sm",
      strong: "glass-overlay",
      solid: "bg-white border border-[var(--ridge-outer)]/50 shadow-lg",
    };
    
    const paddings = {
      none: "",
      sm: "p-3",
      md: "p-6",
      lg: "p-8",
      xl: "p-8 md:p-12",
    };
    
    const roundeds = {
      lg: "rounded-lg",
      xl: "rounded-xl",
      "2xl": "rounded-2xl",
      "3xl": "rounded-[20px]",
    };
    
    return (
      <div
        ref={ref}
        className={cn(
          variants[variant],
          paddings[padding],
          roundeds[rounded],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export { GlassCard };
export type { GlassCardProps };

