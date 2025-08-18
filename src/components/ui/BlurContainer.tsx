import { cn } from "@/lib/utils";

export default function BlurContainer({
  blurred,
  children,
  className,
}: {
  blurred?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "transition-[filter,opacity] duration-200",
        blurred ? "blur-sm opacity-90" : "",
        className
      )}
    >
      {children}
    </div>
  );
}
