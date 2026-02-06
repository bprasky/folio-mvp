import { cn } from "@/lib/utils";
import { forwardRef } from "react";

type HeadlineTag = "h1" | "h2" | "h3" | "h4" | "p" | "span";

interface EditorialHeadlineProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: HeadlineTag;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  italic?: boolean;
  muted?: boolean;
}

const EditorialHeadline = forwardRef<HTMLHeadingElement, EditorialHeadlineProps>(
  ({ as: Tag = "h2", size = "lg", italic = true, muted = false, className, children, ...props }, ref) => {
    
    const sizes = {
      xs: "text-lg md:text-xl",
      sm: "text-xl md:text-2xl",
      md: "text-2xl md:text-3xl",
      lg: "text-3xl md:text-4xl lg:text-5xl",
      xl: "text-4xl md:text-5xl lg:text-6xl",
      "2xl": "text-5xl md:text-6xl lg:text-7xl",
    };
    
    return (
      <Tag
        ref={ref as any}
        className={cn(
          "font-serif leading-tight",
          sizes[size],
          italic && "italic",
          muted ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]",
          className
        )}
        {...props}
      >
        {children}
      </Tag>
    );
  }
);

EditorialHeadline.displayName = "EditorialHeadline";

export { EditorialHeadline };
export type { EditorialHeadlineProps };

