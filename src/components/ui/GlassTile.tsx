import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  "aria-label"?: string;
};

export default function GlassTile({ children, className, as = "section", ...rest }: Props) {
  const Comp: any = as;
  return (
    <Comp
      className={cn(
        // Glassmorphism
        "rounded-2xl border border-white/30 bg-white/60 backdrop-blur-md shadow-lg",
        // Dark mode support (if enabled)
        "dark:bg-neutral-900/50 dark:border-white/10",
        className
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}
