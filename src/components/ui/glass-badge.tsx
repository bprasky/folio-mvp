import { cn } from "@/lib/utils";

interface GlassBadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  className?: string;
}

const GlassBadge = ({ children, variant = "default", className }: GlassBadgeProps) => {
  const variants = {
    default: "bg-gray-100/80 text-gray-700",
    success: "bg-green-100/80 text-green-800",
    warning: "bg-amber-100/80 text-amber-800",
    error: "bg-red-100/80 text-red-800",
    info: "bg-blue-100/80 text-blue-800",
  };
  
  return (
    <span
      className={cn(
        "inline-flex items-center",
        "px-3 py-1",
        "text-xs font-medium",
        "rounded-full",
        "backdrop-blur-sm",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
};

export { GlassBadge };
export type { GlassBadgeProps };

