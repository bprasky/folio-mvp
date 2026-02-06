import { cn } from "@/lib/utils";

interface GlassDividerProps {
  className?: string;
  orientation?: "horizontal" | "vertical";
}

const GlassDivider = ({ className, orientation = "horizontal" }: GlassDividerProps) => {
  return (
    <div
      className={cn(
        "bg-[var(--bg-elevated)]/50",
        orientation === "horizontal" ? "h-px w-full my-6" : "w-px h-full mx-6",
        className
      )}
    />
  );
};

export { GlassDivider };

