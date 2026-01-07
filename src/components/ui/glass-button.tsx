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
      primary: "bg-blue-600 text-white hover:bg-blue-700 shadow-md",
      secondary: "bg-white/70 text-gray-700 border border-gray-200/50 hover:bg-white hover:text-gray-900 shadow-sm",
      ghost: "text-gray-600 hover:text-gray-900 hover:bg-gray-100/50",
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
          "focus:outline-none focus:ring-2 focus:ring-blue-500/30",
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

