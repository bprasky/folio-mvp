"use client";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { forwardRef } from "react";

interface GlassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const sizes = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
  full: "max-w-[95vw]",
};

const GlassModal = forwardRef<HTMLDivElement, GlassModalProps>(
  ({ open, onOpenChange, children, className, title = "Project details", size = "lg" }, ref) => {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          ref={ref}
          aria-describedby={undefined}
          className={cn(
            "w-full h-auto max-h-[90vh]",
            sizes[size],
            "glass-overlay",
            "overflow-hidden",
            "flex flex-col",
            "m-0",
            className
          )}
        >
          <DialogTitle className="sr-only">{title}</DialogTitle>
          {children}
        </DialogContent>
      </Dialog>
    );
  }
);

GlassModal.displayName = "GlassModal";

// Sub-components for modal structure
const GlassModalHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("shrink-0 px-4 sm:px-8 py-4 border-b border-[rgba(190,175,155,0.24)] bg-white/25", className)}>
    {children}
  </div>
);

const GlassModalBody = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("min-h-0 flex-1 overflow-y-auto px-4 sm:px-8 md:px-12 py-8", className)}>
    {children}
  </div>
);

const GlassModalFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("shrink-0 px-4 sm:px-8 py-4 border-t border-[rgba(190,175,155,0.24)] bg-white/25", className)}>
    {children}
  </div>
);

export { GlassModal, GlassModalHeader, GlassModalBody, GlassModalFooter };

