'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContentProps {
  className?: string;
  children: React.ReactNode;
}

interface DialogHeaderProps {
  className?: string;
  children: React.ReactNode;
}

interface DialogTitleProps {
  className?: string;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="relative">
        {children}
      </div>
    </div>
  );
}

export function DialogContent({ className, children }: DialogContentProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-2xl shadow-xl border border-neutral-200 max-w-lg w-full max-h-[90vh] overflow-y-auto",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DialogHeader({ className, children }: DialogHeaderProps) {
  return (
    <div className={cn("px-6 pt-6 pb-4", className)}>
      {children}
    </div>
  );
}

export function DialogTitle({ className, children }: DialogTitleProps) {
  return (
    <h2 className={cn("text-lg font-semibold text-neutral-900", className)}>
      {children}
    </h2>
  );
}

