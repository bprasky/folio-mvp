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
        "glass-surface rounded-2xl",
        "dark:bg-[var(--bg-base)] dark:border-white/10",
        className
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}
