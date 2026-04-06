import { cn } from "@/lib/utils";

interface GlassBadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info";
  className?: string;
}

const GlassBadge = ({ children, variant = "default", className }: GlassBadgeProps) => {
  const variants = {
    default: "glass-badge text-folio-text-primary",
    success: "glass-badge bg-green-100/80 text-green-800",
    warning: "glass-badge bg-amber-100/80 text-amber-800",
    error: "glass-badge bg-red-100/80 text-red-800",
    info: "glass-badge bg-[var(--accent)]/10/80 text-[var(--accent-hover)]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center",
        "px-3 py-1",
        "text-xs font-medium",
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

