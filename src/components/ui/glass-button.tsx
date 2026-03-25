import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  rounded?: "lg" | "xl" | "full";
}

const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = "primary", size = "md", rounded = "full", children, ...props }, ref) => {
    
    const variants = {
      primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] shadow-md",
      secondary: "bg-[var(--glass-bg)] text-[var(--text-primary)] border border-[var(--glass-border)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] shadow-sm",
      ghost: "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50",
      danger: "bg-red-600 text-white hover:bg-red-700 shadow-md",
    };
    
    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-5 py-2 text-base",
      lg: "px-6 py-3 text-lg",
    };
    
    const roundeds = {
      lg: "rounded-lg",
      xl: "rounded-xl",
      full: "rounded-full",
    };
    
    return (
      <button
        ref={ref}
        className={cn(
          "font-medium",
          "transition-colors duration-150",
          "focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          roundeds[rounded],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

GlassButton.displayName = "GlassButton";

export { GlassButton };
export type { GlassButtonProps };

