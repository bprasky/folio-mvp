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
      default: "bg-white/80 backdrop-blur-lg border border-white/30 shadow-lg",
      subtle: "bg-white/50 backdrop-blur-md border border-white/20 shadow-md",
      strong: "bg-white/90 backdrop-blur-xl border border-white/30 shadow-2xl",
      solid: "bg-white border border-gray-200/50 shadow-lg",
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
      "3xl": "rounded-3xl",
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

