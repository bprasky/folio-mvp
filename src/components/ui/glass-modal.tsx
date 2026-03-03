"use client";

import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { forwardRef } from "react";

interface GlassModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
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
  ({ open, onOpenChange, children, className, size = "lg" }, ref) => {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "w-full h-auto max-h-[90vh]",
            sizes[size],
            "bg-white/90 backdrop-blur-xl",
            "border border-white/30",
            "shadow-2xl",
            "rounded-[20px]",
            "overflow-hidden",
            "flex flex-col",
            "m-0",
            className
          )}
        >
          {children}
        </DialogContent>
      </Dialog>
    );
  }
);

GlassModal.displayName = "GlassModal";

// Sub-components for modal structure
const GlassModalHeader = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("px-8 py-4 border-b border-[var(--ridge-outer)]/50 bg-white/50", className)}>
    {children}
  </div>
);

const GlassModalBody = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("flex-1 overflow-y-auto px-8 md:px-12 py-8", className)}>
    {children}
  </div>
);

const GlassModalFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("px-8 py-4 border-t border-[var(--ridge-outer)]/50 bg-white/50", className)}>
    {children}
  </div>
);

export { GlassModal, GlassModalHeader, GlassModalBody, GlassModalFooter };

