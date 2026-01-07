import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  padding?: "none" | "sm" | "md" | "lg";
}

const PageContainer = ({ children, className, size = "xl", padding = "md" }: PageContainerProps) => {
  const sizes = {
    sm: "max-w-3xl",
    md: "max-w-4xl",
    lg: "max-w-5xl",
    xl: "max-w-6xl",
    full: "max-w-full",
  };
  
  const paddings = {
    none: "",
    sm: "px-4 py-6",
    md: "px-6 md:px-8 py-8",
    lg: "px-8 md:px-12 py-12",
  };
  
  return (
    <div className={cn("mx-auto w-full", sizes[size], paddings[padding], className)}>
      {children}
    </div>
  );
};

export { PageContainer };

